from __future__ import annotations

import secrets

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit.service import append_audit
from app.core.errors import ApiError
from app.db.models import Device, Identity, Incident, IncidentNote, new_id, utcnow
from app.domains.events.service import record_event
from app.domains.response.schemas import (
    PlaybookActionId,
    PlaybookActionInfo,
    PlaybookActionOutcome,
    PlaybookCatalog,
    PlaybookResult,
)
from app.security.passwords import hash_password
from app.security.sessions import revoke_identity_sessions

CATALOG: list[PlaybookActionInfo] = [
    PlaybookActionInfo(
        id="DISABLE_IDENTITY",
        label="Disable identity",
        description="Set the identity to DISABLED so no new authentication is possible.",
        severity="CRITICAL",
        reversible=True,
    ),
    PlaybookActionInfo(
        id="REVOKE_SESSIONS",
        label="Revoke active sessions",
        description="Invalidate every live session token for the identity immediately.",
        severity="HIGH",
        reversible=False,
    ),
    PlaybookActionInfo(
        id="ROTATE_CREDENTIALS",
        label="Rotate credentials",
        description="Replace the stored password hash and revoke sessions, forcing re-enrollment.",
        severity="HIGH",
        reversible=False,
    ),
    PlaybookActionInfo(
        id="RESTRICT_DEVICES",
        label="Restrict devices",
        description="Move all non-revoked devices for the identity into the RESTRICTED trust state.",
        severity="HIGH",
        reversible=True,
    ),
    PlaybookActionInfo(
        id="CONTAIN_INCIDENT",
        label="Mark incident contained",
        description="Advance the incident to CONTAINED once exposure is stopped.",
        severity="MEDIUM",
        reversible=True,
    ),
]

_ACTION_LABELS = {item.id: item.label for item in CATALOG}


def catalog() -> PlaybookCatalog:
    return PlaybookCatalog(
        actions=list(CATALOG),
        note=(
            "Playbooks execute deterministic containment actions. Every action is written to the "
            "append-only audit chain and the live event stream; nothing is reversible silently."
        ),
    )


def _get_incident(db: Session, incident_id: str) -> Incident:
    incident = db.get(Incident, incident_id)
    if incident is None:
        raise ApiError(404, "INCIDENT_NOT_FOUND", "Incident not found.")
    return incident


def _apply_action(
    db: Session,
    *,
    action: PlaybookActionId,
    incident: Incident,
    identity: Identity | None,
) -> PlaybookActionOutcome:
    label = _ACTION_LABELS[action]

    if action == "CONTAIN_INCIDENT":
        if incident.status in {"CONTAINED", "RESOLVED", "FALSE_POSITIVE"}:
            return PlaybookActionOutcome(
                action=action, label=label, status="SKIPPED",
                detail=f"Incident already {incident.status.lower()}.",
            )
        incident.status = "CONTAINED"
        return PlaybookActionOutcome(
            action=action, label=label, status="APPLIED",
            detail="Incident advanced to CONTAINED.",
        )

    if identity is None:
        return PlaybookActionOutcome(
            action=action, label=label, status="FAILED",
            detail="Incident is not linked to an identity; action could not be applied.",
        )

    if action == "DISABLE_IDENTITY":
        if identity.status == "DISABLED":
            return PlaybookActionOutcome(
                action=action, label=label, status="SKIPPED",
                detail="Identity is already disabled.",
            )
        identity.status = "DISABLED"
        return PlaybookActionOutcome(
            action=action, label=label, status="APPLIED",
            detail=f"{identity.display_name} is now DISABLED.",
        )

    if action == "REVOKE_SESSIONS":
        revoked = revoke_identity_sessions(db, identity.id)
        if revoked == 0:
            return PlaybookActionOutcome(
                action=action, label=label, status="SKIPPED",
                detail="No active sessions to revoke.",
            )
        return PlaybookActionOutcome(
            action=action, label=label, status="APPLIED",
            detail=f"Revoked {revoked} active session(s).",
        )

    if action == "ROTATE_CREDENTIALS":
        identity.password_hash = hash_password(secrets.token_urlsafe(24))
        revoked = revoke_identity_sessions(db, identity.id)
        return PlaybookActionOutcome(
            action=action, label=label, status="APPLIED",
            detail=f"Credential rotated and {revoked} session(s) invalidated.",
        )

    if action == "RESTRICT_DEVICES":
        devices = list(
            db.scalars(
                select(Device).where(
                    Device.identity_id == identity.id,
                    Device.state != "REVOKED",
                )
            )
        )
        if not devices:
            return PlaybookActionOutcome(
                action=action, label=label, status="SKIPPED",
                detail="No restorable devices found.",
            )
        changed = 0
        for device in devices:
            if device.state != "RESTRICTED":
                device.state = "RESTRICTED"
                device.last_observed_at = utcnow()
                changed += 1
        if changed == 0:
            return PlaybookActionOutcome(
                action=action, label=label, status="SKIPPED",
                detail="All devices are already restricted.",
            )
        return PlaybookActionOutcome(
            action=action, label=label, status="APPLIED",
            detail=f"Restricted {changed} device(s).",
        )

    return PlaybookActionOutcome(
        action=action, label=label, status="FAILED", detail="Unknown action.",
    )


def execute_playbook(
    db: Session,
    *,
    incident_id: str,
    actions: list[PlaybookActionId],
    reason: str,
    actor: Identity,
) -> PlaybookResult:
    incident = _get_incident(db, incident_id)
    identity = db.get(Identity, incident.identity_id) if incident.identity_id else None
    correlation_id = new_id()

    ordered = list(dict.fromkeys(actions))
    outcomes = [
        _apply_action(db, action=action, incident=incident, identity=identity)
        for action in ordered
    ]
    applied = sum(1 for outcome in outcomes if outcome.status == "APPLIED")

    incident.updated_at = utcnow()
    applied_labels = ", ".join(o.label for o in outcomes if o.status == "APPLIED") or "no actions"
    db.add(
        IncidentNote(
            incident_id=incident.id,
            author_id=actor.id,
            author_label=actor.display_name,
            note=(
                f"Response playbook executed ({reason}). Applied: {applied_labels}. "
                f"Skipped/failed: {sum(1 for o in outcomes if o.status != 'APPLIED')}."
            ),
            created_at=utcnow(),
        )
    )
    db.flush()

    record_event(
        db,
        event_type="RESPONSE_PLAYBOOK_EXECUTED",
        category="Response",
        summary=f"Containment playbook run on {incident.title}",
        correlation_id=correlation_id,
        severity="HIGH",
        identity_id=incident.identity_id,
        incident_id=incident.id,
        actor_id=actor.id,
        details={
            "reason": reason,
            "outcomes": [o.model_dump() for o in outcomes],
        },
        is_simulated=incident.is_simulated,
    )
    append_audit(
        db,
        actor=actor,
        action="RESPONSE_PLAYBOOK_EXECUTED",
        target_type="incident",
        target_id=incident.id,
        correlation_id=correlation_id,
        result="SUCCESS",
        metadata={
            "reason": reason,
            "actions": ordered,
            "applied_count": applied,
            "identity_id": incident.identity_id,
            "outcomes": [o.model_dump() for o in outcomes],
        },
    )
    db.commit()
    db.refresh(incident)
    if identity is not None:
        db.refresh(identity)

    return PlaybookResult(
        incident_id=incident.id,
        incident_status=incident.status,
        identity_id=incident.identity_id,
        identity_status=identity.status if identity else None,
        outcomes=outcomes,
        applied_count=applied,
        correlation_id=correlation_id,
        summary=f"{applied} of {len(outcomes)} containment action(s) applied.",
    )
