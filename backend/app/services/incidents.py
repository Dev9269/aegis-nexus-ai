from __future__ import annotations

from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit.service import append_audit
from app.models import (
    AccessRequest,
    Incident,
    IncidentNote,
    Identity,
    Severity,
    new_id,
    utcnow,
)
from app.services.events import record_event

SEVERITY_ORDER = {"LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}


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
