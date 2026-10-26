from __future__ import annotations

from sqlalchemy import select

from app.audit.service import audit_count
from app.models import AccessPolicy, AuditLog, Resource, SecurityEvent
from tests.conftest import login


def make_resource(db, *, key: str = "finance-reports") -> Resource:
    resource = Resource(
        key=key,
        name="Finance Reports",
        description="Finance reporting",
        sensitivity="HIGH",
        owner_department="Finance",
        is_simulated=True,
    )
    db.add(resource)
    db.flush()
    db.add(
        AccessPolicy(
            resource_id=resource.id,
            version=1,
            allowed_roles=["EMPLOYEE", "SECURITY_ADMIN"],
            allowed_device_states=["TRUSTED", "UNVERIFIED"],
            challenge_threshold=55,
            deny_threshold=95,
            require_additional_verification=True,
            session_max_minutes=60,
            is_active=True,
            change_reason="Initial policy",
            is_simulated=True,
        )
    )
    db.commit()
    db.refresh(resource)
    return resource


def draft_payload():
    return {
        "allowed_roles": ["EMPLOYEE", "SECURITY_ADMIN"],
        "allowed_device_states": ["TRUSTED"],
        "challenge_threshold": 50,
        "deny_threshold": 90,
        "require_additional_verification": True,
        "session_max_minutes": 45,
        "reason": "Tighten device and threshold controls",
        "is_active": True,
    }


def test_admin_can_list_resources_with_active_policy(client, db, admin_identity):
    resource = make_resource(db)
    login(client, admin_identity.email)

    response = client.get("/api/resources")
    assert response.status_code == 200, response.text
    body = response.json()
    assert len(body) == 1
    assert body[0]["id"] == resource.id
    assert body[0]["policy"]["version"] == 1
    assert body[0]["version_count"] == 1


def test_employee_cannot_access_policy_center(client, employee_identity):
    login(client, employee_identity.email)
    assert client.get("/api/resources").status_code == 403


def test_policy_preview_returns_deterministic_outcomes_without_persisting(
    client, db, analyst_identity
):
    csrf = login(client, analyst_identity.email)
    before_audits = audit_count(db)
    payload = {
        "draft": draft_payload(),
        "cases": [
            {
                "role": "EMPLOYEE",
                "device_state": "TRUSTED",
                "risk_score": 10,
                "account_active": True,
                "identity_authorized": True,
                "session_active": True,
                "repeated_anomalies": 0,
            },
            {
                "role": "EMPLOYEE",
                "device_state": "TRUSTED",
                "risk_score": 70,
                "account_active": True,
                "identity_authorized": True,
                "session_active": True,
                "repeated_anomalies": 0,
            },
            {
                "role": "EMPLOYEE",
                "device_state": "TRUSTED",
                "risk_score": 99,
                "account_active": True,
                "identity_authorized": True,
                "session_active": True,
                "repeated_anomalies": 0,
            },
            {
                "role": "AUDITOR",
                "device_state": "TRUSTED",
                "risk_score": 0,
                "account_active": True,
                "identity_authorized": True,
                "session_active": True,
                "repeated_anomalies": 0,
            },
        ],
    }
    response = client.post(
        "/api/policies/preview", json=payload, headers={"X-CSRF-Token": csrf}
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["persisted"] is False
    assert [item["decision"] for item in body["results"]] == [
        "ALLOW",
        "CHALLENGE",
        "DENY",
        "DENY",
    ]
    assert audit_count(db) == before_audits


def test_policy_update_creates_new_active_version_and_audit(client, db, admin_identity):
    resource = make_resource(db)
    existing = db.scalar(select(AccessPolicy).where(AccessPolicy.resource_id == resource.id))
    csrf = login(client, admin_identity.email)

    response = client.put(
        f"/api/resources/{resource.id}/policy",
        json=draft_payload(),
        headers={"X-CSRF-Token": csrf},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["version"] == 2
    assert body["challenge_threshold"] == 50

    db.expire_all()
    old = db.get(AccessPolicy, existing.id)
    assert old.is_active is False
    history = client.get(f"/api/resources/{resource.id}/policies")
    assert history.status_code == 200
    assert [item["version"] for item in history.json()] == [2, 1]

    actions = {row.action for row in db.scalars(select(AuditLog))}
    assert "POLICY_VERSION_CREATED" in actions
    event_types = {row.event_type for row in db.scalars(select(SecurityEvent))}
    assert "POLICY_UPDATED" in event_types


def test_policy_update_rejects_invalid_threshold_order(client, db, admin_identity):
    resource = make_resource(db)
    csrf = login(client, admin_identity.email)
    payload = draft_payload()
    payload["challenge_threshold"] = 90
    payload["deny_threshold"] = 90

    response = client.put(
        f"/api/resources/{resource.id}/policy",
        json=payload,
        headers={"X-CSRF-Token": csrf},
    )
    assert response.status_code == 422


def test_analyst_cannot_publish_policy(client, db, analyst_identity):
    resource = make_resource(db)
    csrf = login(client, analyst_identity.email)
    response = client.put(
        f"/api/resources/{resource.id}/policy",
        json=draft_payload(),
        headers={"X-CSRF-Token": csrf},
    )
    assert response.status_code == 403
