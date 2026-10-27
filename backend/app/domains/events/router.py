from __future__ import annotations

import asyncio
from typing import Literal

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.api.deps import AuthContext, require_roles
from app.api.schemas import Page
from app.core.config import get_settings
from app.core.database import SessionLocal, get_db
from app.core.roles import STAFF_ROLES
from app.db.models import Identity
from app.domains.events.schemas import NotificationOut, SecurityEventOut
from app.domains.events.service import (
    get_event as get_event_service,
    list_events as list_events_service,
    list_notifications as list_notifications_service,
)
from app.realtime import realtime
from app.security.sessions import SESSION_COOKIE, resolve_session

router = APIRouter(tags=["events"])
settings = get_settings()


def _stream_authorized(raw_token: str | None) -> bool:
    with SessionLocal() as db:
        session = resolve_session(db, raw_token)
        identity = db.get(Identity, session.identity_id) if session else None
    return bool(identity and identity.status == "ACTIVE" and identity.role in STAFF_ROLES)


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
    return list_events_service(
        db,
        filters={
            "q": q,
            "event_type": event_type,
            "category": category,
            "severity": severity,
            "identity_id": identity_id,
            "from_time": from_time,
            "to_time": to_time,
        },
        page=page,
        page_size=page_size,
    )


@router.get("/events/{event_id}", response_model=SecurityEventOut)
def get_event(
    event_id: str,
    auth: AuthContext = Depends(require_roles(*STAFF_ROLES)),
    db: Session = Depends(get_db),
) -> SecurityEventOut:
    return get_event_service(db, event_id)


@router.get("/notifications", response_model=list[NotificationOut])
def list_notifications(
    auth: AuthContext = Depends(require_roles(*STAFF_ROLES)),
    db: Session = Depends(get_db),
) -> list[NotificationOut]:
    return list_notifications_service(db)


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
