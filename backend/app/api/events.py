from __future__ import annotations

import asyncio
from typing import Literal

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import AuthContext, require_roles
from app.api.schemas import Page
from app.core.config import get_settings
from app.core.database import SessionLocal, get_db
from app.core.errors import ApiError
from app.core.pagination import page_offset, page_response
from app.core.roles import STAFF_ROLES
from app.core.time import parse_optional_utc
from app.models import Identity, SecurityEvent
from app.realtime import realtime
from app.schemas import NotificationOut, SecurityEventOut
from app.security.sessions import SESSION_COOKIE, resolve_session
from app.serializers import event_out

router = APIRouter(tags=["events"])
_SEVERITIES = ("LOW", "MEDIUM", "HIGH", "CRITICAL")
settings = get_settings()


def _stream_authorized(raw_token: str | None) -> bool:
    with SessionLocal() as db:
        session = resolve_session(db, raw_token)
        identity = db.get(Identity, session.identity_id) if session else None
    return bool(
        identity
        and identity.status == "ACTIVE"
        and identity.role in STAFF_ROLES
    )


async def _close_if_unauthorized(websocket: WebSocket, raw_token: str | None) -> bool:
    if _stream_authorized(raw_token):
        return False
    await websocket.close(code=4401)
    return True


@router.get("/events", response_model=Page[SecurityEventOut])
def list_events(
    q: str | None = Query(default=None, max_length=120),
    event_type: str | None = Query(default=None, max_length=80),
    category: str | None = Query(default=None, max_length=80),
    severity: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"] | None = Query(default=None),
    identity_id: str | None = Query(default=None, max_length=36),
    from_time: str | None = Query(default=None, max_length=40),
    to_time: str | None = Query(default=None, max_length=40),
    page: int = Query(default=1, ge=1, le=10000),
    page_size: int = Query(default=25, ge=1, le=100),
    auth: AuthContext = Depends(require_roles(*STAFF_ROLES)),
    db: Session = Depends(get_db),
) -> Page[SecurityEventOut]:
    query = select(SecurityEvent)
    count_query = select(func.count(SecurityEvent.id))
    filters = []
    if q:
        pattern = f"%{q.strip()}%"
        filters.append(
            or_(
                SecurityEvent.summary.ilike(pattern),
                SecurityEvent.event_type.ilike(pattern),
                SecurityEvent.category.ilike(pattern),
            )
        )
    if event_type:
        filters.append(SecurityEvent.event_type == event_type)
    if category:
        filters.append(SecurityEvent.category == category)
    if severity:
        filters.append(SecurityEvent.severity == severity)
    if identity_id:
        filters.append(SecurityEvent.identity_id == identity_id)
    start = parse_optional_utc(from_time, "from_time")
    end = parse_optional_utc(to_time, "to_time")
    if start:
        filters.append(SecurityEvent.timestamp >= start)
    if end:
        filters.append(SecurityEvent.timestamp <= end)
    if filters:
        query = query.where(*filters)
        count_query = count_query.where(*filters)
    total = int(db.scalar(count_query) or 0)
    rows = list(
        db.scalars(
            query.order_by(SecurityEvent.timestamp.desc())
            .offset(page_offset(page, page_size))
            .limit(page_size)
        )
    )
    return page_response(
        [event_out(row) for row in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/events/{event_id}", response_model=SecurityEventOut)
def get_event(
    event_id: str,
    auth: AuthContext = Depends(require_roles(*STAFF_ROLES)),
    db: Session = Depends(get_db),
) -> SecurityEventOut:
    event = db.get(SecurityEvent, event_id)
    if event is None:
        raise ApiError(404, "EVENT_NOT_FOUND", "Security event not found.")
    return event_out(event)


@router.get("/notifications", response_model=list[NotificationOut])
def list_notifications(
    auth: AuthContext = Depends(require_roles(*STAFF_ROLES)),
    db: Session = Depends(get_db),
) -> list[NotificationOut]:
    events = list(
        db.scalars(
            select(SecurityEvent)
            .where(SecurityEvent.severity.in_(["HIGH", "CRITICAL"]))
            .order_by(SecurityEvent.timestamp.desc())
            .limit(8)
        )
    )
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


@router.websocket("/ws/events")
async def event_stream(websocket: WebSocket) -> None:
    raw_token = websocket.cookies.get(SESSION_COOKIE)
    if not _stream_authorized(raw_token):
        await websocket.close(code=4401)
        return

    await realtime.connect(websocket)
    try:
        await websocket.send_json(
            {
                "type": "connected",
                "message": "AEGIS live event stream connected.",
                "severity": "INFO",
            }
        )
        while True:
            try:
                message = await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=max(1, settings.ws_revalidation_seconds),
                )
            except asyncio.TimeoutError:
                if await _close_if_unauthorized(websocket, raw_token):
                    break
                await websocket.send_json({"type": "heartbeat"})
                continue
            if await _close_if_unauthorized(websocket, raw_token):
                break
            if message.lower() in {"ping", "heartbeat"}:
                await websocket.send_json({"type": "pong"})
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        realtime.disconnect(websocket)
