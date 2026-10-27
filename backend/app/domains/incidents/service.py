from __future__ import annotations

from datetime import timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.schemas import Page
from app.audit.service import append_audit
from app.core.errors import ApiError
from app.core.pagination import page_response
from app.db.models import (
    AccessRequest,
    Identity,
    Incident,
    IncidentNote,
    Severity,
    new_id,
    utcnow,
)
from app.domains.access.presenters import access_out
from app.domains.events.presenters import event_out
from app.domains.events.service import record_event
from app.domains.incidents import repository
from app.domains.incidents.presenters import incident_out
from app.domains.incidents.schemas import (
    IncidentDetail,
    IncidentNoteIn,
    IncidentNoteOut,
    IncidentOut,
    IncidentUpdateIn,
)

SEVERITY_ORDER = {"LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}


def _get_incident(db: Session, incident_id: str) -> Incident:
    incident = repository.get_incident_row(db, incident_id)
    if incident is None:
        raise ApiError(404, "INCIDENT_NOT_FOUND", "Incident not found.")
    return incident


def _add_note(
    db: Session,
    *,
    incident: Incident,
    actor: Identity,
    note: str,
    correlation_id: str,
) -> IncidentNote:
    row = IncidentNote(
        incident_id=incident.id,
        author_id=actor.id,
        author_label=actor.display_name,
        note=note,
        created_at=utcnow(),
    )
    db.add(row)
    record_event(
        db,
        event_type="INCIDENT_NOTE_ADDED",
        category="Incident",
        summary=f"Investigation note added to {incident.title}",
        correlation_id=correlation_id,
        severity="LOW",
        identity_id=incident.identity_id,
        incident_id=incident.id,
        actor_id=actor.id,
        details={"author": actor.display_name},
        is_simulated=incident.is_simulated,
    )
    return row


def list_incidents(
    db: Session, *, filters: dict[str, Any], page: int, page_size: int
) -> Page[IncidentOut]:
    rows, total = repository.list_incident_rows(
        db,
        filters=filters,
        page=page,
        page_size=page_size,
    )
    return page_response(
        [incident_out(row) for row in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


def get_incident(db: Session, incident_id: str) -> IncidentDetail:
    incident = _get_incident(db, incident_id)
    related_access_ids = incident.related_access_request_ids or []
    access_rows = repository.list_related_access(db, related_access_ids)
    timeline = repository.list_incident_timeline(db, incident.id, related_access_ids)
    notes = repository.list_notes(db, incident.id)
    return IncidentDetail(
        **incident_out(incident).model_dump(),
        notes=[IncidentNoteOut.model_validate(note) for note in notes],
        timeline=[event_out(event) for event in timeline],
        access_requests=[access_out(row) for row in access_rows],
    )


def update_incident(
    db: Session, *, incident_id: str, payload: IncidentUpdateIn, actor: Identity
) -> IncidentDetail:
    incident = _get_incident(db, incident_id)
    if (
        payload.status is None
        and payload.severity is None
        and payload.assigned_to is None
        and payload.resolution is None
        and payload.note is None
    ):
        raise ApiError(422, "NO_CHANGES", "At least one incident field must be updated.")

    correlation_id = new_id()
    before = {
        "status": incident.status,
        "severity": incident.severity,
        "assigned_to": incident.assigned_to,
    }

    if payload.assigned_to is not None:
        assignee = db.get(Identity, payload.assigned_to)
        if assignee is None or assignee.status != "ACTIVE":
            raise ApiError(
                422,
                "INVALID_ASSIGNEE",
                "Assigned identity is not active or does not exist.",
            )
        if assignee.role not in {"SECURITY_ADMIN", "SECURITY_ANALYST"}:
            raise ApiError(
                422,
                "INVALID_ASSIGNEE",
                "Incidents can only be assigned to security staff.",
            )
        incident.assigned_to = assignee.id
    elif "assigned_to" in payload.model_fields_set:
        incident.assigned_to = None

    if payload.severity:
        incident.severity = payload.severity
    if payload.status:
        incident.status = payload.status
    if payload.resolution is not None:
        incident.resolution = payload.resolution
    if payload.status in {"RESOLVED", "FALSE_POSITIVE"}:
        if not (payload.resolution or incident.resolution):
            raise ApiError(
                422,
                "RESOLUTION_REQUIRED",
                "A resolution summary is required when closing an incident.",
            )

    incident.updated_at = utcnow()
    if payload.note:
        _add_note(
            db,
            incident=incident,
            actor=actor,
            note=payload.note,
            correlation_id=correlation_id,
        )

    after = {
        "status": incident.status,
        "severity": incident.severity,
        "assigned_to": incident.assigned_to,
    }
    record_event(
        db,
        event_type="INCIDENT_UPDATED",
        category="Incident",
        summary=f"Incident updated: {incident.title}",
        correlation_id=correlation_id,
        severity=incident.severity,
        identity_id=incident.identity_id,
        incident_id=incident.id,
        actor_id=actor.id,
        details={"before": before, "after": after},
        is_simulated=incident.is_simulated,
    )
    append_audit(
        db,
        actor=actor,
        action="INCIDENT_UPDATED",
        target_type="incident",
        target_id=incident.id,
        correlation_id=correlation_id,
        result="SUCCESS",
        metadata={
            "before": before,
            "after": after,
            "resolution": payload.resolution,
            "note_added": bool(payload.note),
        },
    )
    db.commit()
    return get_incident(db, incident_id)


def add_incident_note(
    db: Session, *, incident_id: str, payload: IncidentNoteIn, actor: Identity
) -> IncidentNoteOut:
    incident = _get_incident(db, incident_id)
    correlation_id = new_id()
    note = _add_note(
        db,
        incident=incident,
        actor=actor,
        note=payload.note,
        correlation_id=correlation_id,
    )
    incident.updated_at = utcnow()
    append_audit(
        db,
        actor=actor,
        action="INCIDENT_NOTE_ADDED",
        target_type="incident",
        target_id=incident.id,
        correlation_id=correlation_id,
        result="SUCCESS",
        metadata={"note_length": len(payload.note)},
    )
    db.commit()
    db.refresh(note)
    return IncidentNoteOut.model_validate(note)


def create_or_escalate_for_decision(
    db: Session,
    *,
    identity: Identity,
    access_request: AccessRequest,
    is_simulated: bool,
) -> Incident | None:
    if access_request.risk_score < 80 and access_request.decision not in {"RESTRICT", "DENY"}:
        return None
    if access_request.decision == "DENY" and access_request.risk_score < 80:
        return None

    since = utcnow() - timedelta(hours=24)
    existing = db.scalar(
        select(Incident)
        .where(
            Incident.identity_id == identity.id,
            Incident.status.in_(["OPEN", "INVESTIGATING", "CONTAINED"]),
            Incident.created_at >= since,
        )
        .order_by(Incident.created_at.desc())
        .limit(1)
    )
    severity = (
        Severity.CRITICAL.value
        if access_request.risk_score >= 90
        else Severity.HIGH.value
        if access_request.risk_score >= 70
        else Severity.MEDIUM.value
    )
    classification = "Unusual behavior requiring investigation"
    summary = (
        f"Policy engine recorded risk {access_request.risk_score:.1f} and decision "
        f"{access_request.decision} for {identity.display_name}. This is an investigation lead, "
        "not confirmed malicious activity."
    )
    correlation_id = access_request.correlation_id
    if existing:
        existing.related_access_request_ids = list(
            dict.fromkeys((existing.related_access_request_ids or []) + [access_request.id])
        )
        if access_request.device_id:
            existing.related_device_ids = list(
                dict.fromkeys((existing.related_device_ids or []) + [access_request.device_id])
            )
        if SEVERITY_ORDER.get(severity, 0) > SEVERITY_ORDER.get(existing.severity, 0):
            existing.severity = severity
        existing.summary = summary
        existing.updated_at = utcnow()
        db.add(
            IncidentNote(
                incident_id=existing.id,
                author_id=None,
                author_label="AEGIS policy engine",
                note=(
                    f"Additional high-risk event correlated: request {access_request.id[:8]} "
                    f"({access_request.decision}, risk {access_request.risk_score:.1f}). Investigation priority increased."
                ),
            )
        )
        db.flush()
        record_event(
            db,
            event_type="INCIDENT_ESCALATED",
            category="Incident",
            summary=f"Investigation priority increased for {existing.title}",
            correlation_id=correlation_id,
            severity=severity,
            identity_id=identity.id,
            device_id=access_request.device_id,
            access_request_id=access_request.id,
            incident_id=existing.id,
            details={"risk_score": access_request.risk_score, "decision": access_request.decision},
            is_simulated=is_simulated,
        )
        append_audit(
            db,
            actor=None,
            actor_label="AEGIS policy engine",
            action="INCIDENT_ESCALATED",
            target_type="incident",
            target_id=existing.id,
            correlation_id=correlation_id,
            metadata={"access_request_id": access_request.id, "severity": existing.severity},
        )
        return existing

    incident = Incident(
        title=f"Unusual behavior requiring investigation — {identity.display_name}",
        classification=classification,
        severity=severity,
        status="OPEN",
        identity_id=identity.id,
        summary=summary,
        related_access_request_ids=[access_request.id],
        related_device_ids=[access_request.device_id] if access_request.device_id else [],
        created_at=utcnow(),
        updated_at=utcnow(),
        is_simulated=is_simulated,
    )
    db.add(incident)
    db.flush()
    record_event(
        db,
        event_type="INCIDENT_CREATED",
        category="Incident",
        summary=f"Investigation opened for {identity.display_name}",
        correlation_id=correlation_id,
        severity=severity,
        identity_id=identity.id,
        device_id=access_request.device_id,
        access_request_id=access_request.id,
        incident_id=incident.id,
        details={
            "classification": classification,
            "risk_score": access_request.risk_score,
            "decision": access_request.decision,
        },
        is_simulated=is_simulated,
    )
    append_audit(
        db,
        actor=None,
        actor_label="AEGIS policy engine",
        action="INCIDENT_CREATED",
        target_type="incident",
        target_id=incident.id,
        correlation_id=correlation_id,
        metadata={
            "access_request_id": access_request.id,
            "severity": severity,
            "classification": classification,
        },
    )
    return incident
