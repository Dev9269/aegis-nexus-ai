from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.api.schemas import Page
from app.core.errors import ApiError
from app.core.pagination import page_response
from app.db.models import SecurityEvent, Severity, new_id, utcnow
from app.domains.events import repository
from app.domains.events.presenters import event_out
from app.domains.events.schemas import NotificationOut, SecurityEventOut
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


def list_events(
    db: Session, *, filters: dict[str, Any], page: int, page_size: int
) -> Page[SecurityEventOut]:
    rows, total = repository.list_event_rows(
        db,
        filters=filters,
        page=page,
        page_size=page_size,
    )
    return page_response(
        [event_out(row) for row in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


def get_event(db: Session, event_id: str) -> SecurityEventOut:
    event = repository.get_event_row(db, event_id)
    if event is None:
        raise ApiError(404, "EVENT_NOT_FOUND", "Security event not found.")
    return event_out(event)


def list_notifications(db: Session) -> list[NotificationOut]:
    events = repository.list_notification_rows(db)
    notifications: list[NotificationOut] = []
    for event in events:
        if event.incident_id:
            link = f"/incidents?incident={event.incident_id}"
        elif event.access_request_id:
            link = f"/access?request={event.access_request_id}"
        elif event.identity_id:
            link = f"/identities/{event.identity_id}"
        else:
            link = "/events"
        notifications.append(
            NotificationOut(
                id=event.id,
                title=event.summary,
                severity=event.severity,
                timestamp=event.timestamp,
                event_type=event.event_type,
                link=link,
            )
        )
    return notifications
