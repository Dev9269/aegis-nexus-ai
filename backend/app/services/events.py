from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.models import SecurityEvent, Severity, new_id, utcnow
from app.realtime import realtime


def event_payload(event: SecurityEvent) -> dict[str, Any]:
    return {
        "type": "security_event",
        "event": {
            "id": event.id,
            "event_type": event.event_type,
            "category": event.category,
            "severity": event.severity,
            "summary": event.summary,
            "identity_id": event.identity_id,
            "device_id": event.device_id,
            "access_request_id": event.access_request_id,
            "incident_id": event.incident_id,
            "actor_id": event.actor_id,
            "policy_version": event.policy_version,
            "correlation_id": event.correlation_id,
            "details": event.details or {},
            "timestamp": event.timestamp.isoformat(),
            "is_simulated": event.is_simulated,
        },
    }


def record_event(
    db: Session,
    *,
    event_type: str,
    category: str,
    summary: str,
    correlation_id: str,
    severity: str = Severity.LOW.value,
    identity_id: str | None = None,
    device_id: str | None = None,
    access_request_id: str | None = None,
    incident_id: str | None = None,
    actor_id: str | None = None,
    policy_version: str | None = None,
    details: dict[str, Any] | None = None,
    is_simulated: bool = False,
) -> SecurityEvent:
    event = SecurityEvent(
        id=new_id(),
        event_type=event_type,
        category=category,
        severity=severity,
        summary=summary,
        identity_id=identity_id,
        device_id=device_id,
        access_request_id=access_request_id,
        incident_id=incident_id,
        actor_id=actor_id,
        policy_version=policy_version,
        correlation_id=correlation_id,
        details=details or {},
        timestamp=utcnow(),
        is_simulated=is_simulated,
    )
    db.add(event)
    db.flush()
    realtime.broadcast_threadsafe(event_payload(event))
    return event
