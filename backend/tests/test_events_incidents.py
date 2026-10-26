from __future__ import annotations

import pytest
from sqlalchemy import select
from starlette.websockets import WebSocketDisconnect

from app.models import AuditLog, Incident, new_id
from app.services.events import record_event
from tests.conftest import login


def _incident(db, identity, **overrides) -> Incident:
    incident = Incident(
        title="Unusual behavior requiring investigation — Employee",
        classification="Unusual behavior requiring investigation",
        severity="HIGH",
        status="OPEN",
        identity_id=identity.id,
        summary="Policy engine observed high risk for this identity.",
        related_access_request_ids=[],
        related_device_ids=[],
        is_simulated=True,
        **overrides,
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)
    return incident


def test_event_list_filters_and_notifications(client, db, admin_identity):
    login(client, admin_identity.email)
    record_event(
        db,
        event_type="ANOMALY_DETECTED",
        category="Anomaly",
        summary="High behavioral risk detected for test identity",
        correlation_id=new_id(),
        severity="CRITICAL",
        identity_id=admin_identity.id,
        details={"risk_score": 91.2},
        is_simulated=True,
    )
    record_event(
        db,
        event_type="AUTH_SUCCESS",
        category="Authentication",
        summary="Successful authentication",
        correlation_id=new_id(),
        severity="LOW",
        identity_id=admin_identity.id,
        is_simulated=True,
    )
    db.commit()

    response = client.get("/api/events?severity=CRITICAL")
    assert response.status_code == 200, response.text
    assert response.json()["total"] == 1
    assert response.json()["items"][0]["event_type"] == "ANOMALY_DETECTED"

    notifications = client.get("/api/notifications")
    assert notifications.status_code == 200
    assert notifications.json()[0]["severity"] == "CRITICAL"
    assert notifications.json()[0]["link"].startswith("/identities/")


def test_event_stream_requires_authentication(client):
    with pytest.raises(WebSocketDisconnect) as exc_info:
        with client.websocket_connect("/api/ws/events"):
            pass
    assert exc_info.value.code == 4401


def test_event_stream_ping_with_authenticated_staff(client, admin_identity):
    login(client, admin_identity.email)
    with client.websocket_connect("/api/ws/events") as websocket:
        connected = websocket.receive_json()
        assert connected["type"] == "connected"
        websocket.send_text("ping")
        assert websocket.receive_json() == {"type": "pong"}


def test_incident_workflow_and_notes(client, db, admin_identity, analyst_identity):
    incident = _incident(db, analyst_identity)
    csrf = login(client, admin_identity.email)

    listing = client.get("/api/incidents?status=OPEN")
    assert listing.status_code == 200, listing.text
    assert listing.json()["total"] == 1

    note_response = client.post(
        f"/api/incidents/{incident.id}/notes",
        json={"note": "Reviewing identity and device evidence."},
        headers={"X-CSRF-Token": csrf},
    )
    assert note_response.status_code == 200, note_response.text
    assert note_response.json()["author_label"] == admin_identity.display_name

    update = client.patch(
        f"/api/incidents/{incident.id}",
        json={
            "status": "INVESTIGATING",
            "assigned_to": analyst_identity.id,
            "note": "Assigned for deeper investigation.",
        },
        headers={"X-CSRF-Token": csrf},
    )
    assert update.status_code == 200, update.text
    body = update.json()
    assert body["status"] == "INVESTIGATING"
    assert body["assigned_to"] == analyst_identity.id
    assert len(body["notes"]) == 2
    assert len(body["timeline"]) >= 2

    missing_resolution = client.patch(
        f"/api/incidents/{incident.id}",
        json={"status": "RESOLVED"},
        headers={"X-CSRF-Token": csrf},
    )
    assert missing_resolution.status_code == 422

    resolved = client.patch(
        f"/api/incidents/{incident.id}",
        json={"status": "RESOLVED", "resolution": "Verified legitimate travel; no compromise found."},
        headers={"X-CSRF-Token": csrf},
    )
    assert resolved.status_code == 200, resolved.text
    assert resolved.json()["status"] == "RESOLVED"

    db.expire_all()
    actions = {row.action for row in db.scalars(select(AuditLog))}
    assert "INCIDENT_NOTE_ADDED" in actions
    assert "INCIDENT_UPDATED" in actions


def test_auditor_cannot_modify_incident(client, db, auditor_identity, analyst_identity):
    incident = _incident(db, analyst_identity)
    csrf = login(client, auditor_identity.email)
    response = client.post(
        f"/api/incidents/{incident.id}/notes",
        json={"note": "Auditor should not be able to add this note."},
        headers={"X-CSRF-Token": csrf},
    )
    assert response.status_code == 403


def test_employee_cannot_list_incidents(client, employee_identity):
    login(client, employee_identity.email)
    assert client.get("/api/incidents").status_code == 403
