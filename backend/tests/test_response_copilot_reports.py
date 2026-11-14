from __future__ import annotations

from sqlalchemy import select

from app.models import AuditLog, Device, Identity, Incident, SecurityEvent, new_id
from app.security.sessions import create_session
from tests.conftest import login


def _incident(db, identity, **overrides) -> Incident:
    incident = Incident(
        title="Unusual behavior requiring investigation",
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


def _device(db, identity, state: str = "TRUSTED") -> Device:
    device = Device(
        identity_id=identity.id,
        name="Target Laptop",
        device_type="Laptop",
        operating_system="Windows 11",
        state=state,
        enrollment_status="ENROLLED",
        signals={},
        is_simulated=True,
    )
    db.add(device)
    db.commit()
    db.refresh(device)
    return device


def test_playbook_catalog_requires_staff(client, employee_identity):
    login(client, employee_identity.email)
    assert client.get("/api/response/playbooks").status_code == 403


def test_playbook_containment_applies_actions(
    client, db, admin_identity, employee_identity
):
    device = _device(db, employee_identity, state="TRUSTED")
    create_session(db, employee_identity, ttl_minutes=60, is_simulated=True)
    db.commit()
    incident = _incident(db, employee_identity)

    csrf = login(client, admin_identity.email)

    catalog = client.get("/api/response/playbooks")
    assert catalog.status_code == 200, catalog.text
    assert len(catalog.json()["actions"]) == 5

    response = client.post(
        f"/api/response/incidents/{incident.id}/actions",
        json={
            "actions": [
                "DISABLE_IDENTITY",
                "REVOKE_SESSIONS",
                "RESTRICT_DEVICES",
                "CONTAIN_INCIDENT",
            ],
            "reason": "Confirmed credential compromise during investigation.",
        },
        headers={"X-CSRF-Token": csrf},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["incident_status"] == "CONTAINED"
    assert body["identity_status"] == "DISABLED"
    assert body["applied_count"] >= 3

    db.expire_all()
    assert db.get(Identity, employee_identity.id).status == "DISABLED"
    assert db.get(Device, device.id).state == "RESTRICTED"
    assert db.get(Incident, incident.id).status == "CONTAINED"

    actions = {row.action for row in db.scalars(select(AuditLog))}
    assert "RESPONSE_PLAYBOOK_EXECUTED" in actions
    event_types = {row.event_type for row in db.scalars(select(SecurityEvent))}
    assert "RESPONSE_PLAYBOOK_EXECUTED" in event_types


def test_playbook_requires_write_role(client, db, auditor_identity, employee_identity):
    incident = _incident(db, employee_identity)
    csrf = login(client, auditor_identity.email)
    response = client.post(
        f"/api/response/incidents/{incident.id}/actions",
        json={"actions": ["DISABLE_IDENTITY"], "reason": "Auditor cannot contain."},
        headers={"X-CSRF-Token": csrf},
    )
    assert response.status_code == 403


def test_playbook_missing_incident_returns_404(client, admin_identity):
    csrf = login(client, admin_identity.email)
    response = client.post(
        f"/api/response/incidents/{new_id()}/actions",
        json={"actions": ["CONTAIN_INCIDENT"], "reason": "Unknown incident id."},
        headers={"X-CSRF-Token": csrf},
    )
    assert response.status_code == 404


def test_copilot_intent_routing(client, db, admin_identity, employee_identity):
    db.add(
        Identity(
            display_name="High Risk User",
            email="risk@aegisnexus.ai",
            password_hash="scrypt$0$0$0$AA$AA",
            role="EMPLOYEE",
            status="ACTIVE",
            current_risk=97.0,
            is_simulated=True,
        )
    )
    _incident(db, employee_identity)
    db.commit()
    csrf = login(client, admin_identity.email)
    headers = {"X-CSRF-Token": csrf}

    risky = client.post(
        "/api/copilot/ask",
        json={"question": "Which identities are highest risk?"},
        headers=headers,
    )
    assert risky.status_code == 200, risky.text
    assert risky.json()["intent"] == "risky_identities"
    assert risky.json()["read_only"] is True

    incidents = client.post(
        "/api/copilot/ask", json={"question": "Show me open incidents"}, headers=headers
    )
    assert incidents.json()["intent"] == "open_incidents"

    leaks = client.post(
        "/api/copilot/ask",
        json={"question": "Any leaked credentials on the dark web?"},
        headers=headers,
    )
    assert leaks.json()["intent"] == "leaks"

    posture = client.post(
        "/api/copilot/ask",
        json={"question": "What is our current security posture?"},
        headers=headers,
    )
    assert posture.json()["intent"] == "posture"


def test_copilot_requires_staff(client, employee_identity):
    csrf = login(client, employee_identity.email)
    response = client.post(
        "/api/copilot/ask", json={"question": "status"}, headers={"X-CSRF-Token": csrf}
    )
    assert response.status_code == 403


def test_executive_report_json_and_pdf(client, db, admin_identity, employee_identity):
    _incident(db, employee_identity)
    login(client, admin_identity.email)

    report = client.get("/api/reports/executive")
    assert report.status_code == 200, report.text
    body = report.json()
    assert body["overall_risk"] in {"NOMINAL", "GUARDED", "ELEVATED"}
    assert any(section["title"] == "Access decisions" for section in body["sections"])
    assert body["highlights"]

    pdf = client.get("/api/reports/executive.pdf")
    assert pdf.status_code == 200, pdf.text
    assert pdf.headers["content-type"] == "application/pdf"
    assert "attachment" in pdf.headers["content-disposition"]
    assert pdf.content.startswith(b"%PDF-1.4")
    assert b"%%EOF" in pdf.content


def test_executive_report_requires_staff(client, employee_identity):
    login(client, employee_identity.email)
    assert client.get("/api/reports/executive").status_code == 403
    assert client.get("/api/reports/executive.pdf").status_code == 403
