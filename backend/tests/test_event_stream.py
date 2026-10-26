from __future__ import annotations

import pytest
from starlette.websockets import WebSocketDisconnect

from app.core.database import SessionLocal
from app.models import UserSession
from app.security.sessions import revoke_session
from tests.conftest import login


def _revoke_all_sessions(db) -> None:
    for session in db.query(UserSession).all():
        revoke_session(db, session)
    db.commit()


def test_event_stream_rejects_anonymous_connections(client):
    with pytest.raises(WebSocketDisconnect) as exc:
        with client.websocket_connect("/api/ws/events"):
            pass

    assert exc.value.code == 4401


def test_event_stream_closes_after_session_revocation(client, admin_identity):
    login(client, admin_identity.email)

    with client.websocket_connect("/api/ws/events") as websocket:
        assert websocket.receive_json()["type"] == "connected"
        with SessionLocal() as db:
            _revoke_all_sessions(db)
        websocket.send_text("ping")
        with pytest.raises(WebSocketDisconnect) as exc:
            websocket.receive_json()

    assert exc.value.code == 4401
