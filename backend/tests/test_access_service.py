from __future__ import annotations

from app.audit.service import audit_count
from app.models import (
    AccessPolicy,
    AuditLog,
    BehavioralEvent,
    Device,
    DeviceState,
    Resource,
    Sensitivity,
    new_id,
    utcnow,
)
from app.security.sessions import create_session
from tests.conftest import login
from sqlalchemy import select


NORMAL_FEATURES = {
    "login_hour": 10,
    "day_of_week": 2,
    "failed_logins_15m": 0,
    "requests_1h": 12,
    "distinct_resources_1h": 4,
    "sensitive_access_ratio": 0.2,
    "new_device": False,
    "geo_novelty": False,
    "session_duration_min": 45,
    "activity_deviation": 0.2,
}

ANOMALOUS_FEATURES = {
    "login_hour": 3,
    "day_of_week": 6,
    "failed_logins_15m": 14,
    "requests_1h": 320,
    "distinct_resources_1h": 38,
    "sensitive_access_ratio": 0.95,
    "new_device": True,
    "geo_novelty": True,
    "session_duration_min": 4,
    "activity_deviation": 8.5,
}


def make_resource(
    db,
    *,
    key: str = "finance-reports",
    allowed_roles: list[str] | None = None,
    allowed_device_states: list[str] | None = None,
    challenge_threshold: int = 55,
    deny_threshold: int = 95,
    with_policy: bool = True,
) -> Resource:
    resource = Resource(
        key=key,
        name="Finance Reports",
        description="Test resource",
        sensitivity=Sensitivity.HIGH.value,
        owner_department="Finance",
        is_simulated=True,
    )
    db.add(resource)
    db.flush()
    if with_policy:
        db.add(
            AccessPolicy(
                resource_id=resource.id,
                version=1,
                allowed_roles=allowed_roles or ["EMPLOYEE", "SECURITY_ADMIN"],
                allowed_device_states=allowed_device_states or ["TRUSTED", "UNVERIFIED"],
                challenge_threshold=challenge_threshold,
                deny_threshold=deny_threshold,
                require_additional_verification=True,
                session_max_minutes=60,
                is_active=True,
                change_reason="Test policy",
                is_simulated=True,
            )
        )
    db.commit()
    db.refresh(resource)
    return resource


def make_device(db, identity, state: str = DeviceState.TRUSTED.value) -> Device:
    device = Device(
        identity_id=identity.id,
        name=f"{identity.display_name} laptop",
        device_type="laptop",
        operating_system="Windows 11",
        state=state,
        enrollment_status="ENROLLED",
        signals={"managed": True},
        is_simulated=True,
    )
    db.add(device)
    db.commit()
    db.refresh(device)
    return device


def add_session(db, identity) -> None:
    create_session(db, identity, 60, is_simulated=True)
    db.commit()


def post_decision(client, csrf, resource, device=None, *, identity_id=None, features=None, action="READ", simulate=False):
    payload = {
        "identity_id": identity_id,
        "resource_id": resource.id,
        "device_id": device.id if device else None,
        "requested_action": action,
        "features": features or NORMAL_FEATURES,
        "simulate": simulate,
    }
    return client.post("/api/access-requests/evaluate", json=payload, headers={"X-CSRF-Token": csrf})


def test_employee_low_risk_authorized_request_is_allowed(client, db, employee_identity):
    resource = make_resource(db)
    device = make_device(db, employee_identity)
    csrf = login(client, employee_identity.email)

    response = post_decision(client, csrf, resource, device)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["decision"] == "ALLOW"
    assert body["risk_category"] == "LOW"
    assert body["policy_version"] == "finance-reports:v1"
    assert body["reasons"][0]["code"] == "ALL_POLICIES_SATISFIED"

    listing = client.get("/api/access-requests")
    assert listing.status_code == 200
    assert listing.json()["total"] == 1
    assert listing.json()["items"][0]["id"] == body["request_id"]

    detail = client.get(f"/api/access-requests/{body['request_id']}")
    assert detail.status_code == 200
    assert detail.json()["features"]["requests_1h"] == 12
    assert detail.json()["model_version"]


def test_unauthorized_role_is_denied_even_with_low_risk(client, db, employee_identity):
    resource = make_resource(db, allowed_roles=["SECURITY_ADMIN"])
    device = make_device(db, employee_identity)
    csrf = login(client, employee_identity.email)

    response = post_decision(client, csrf, resource, device)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["decision"] == "DENY"
    assert "ROLE_NOT_AUTHORIZED" in {reason["code"] for reason in body["reasons"]}
    assert body["risk_category"] == "LOW"


def test_disabled_identity_is_denied_with_low_risk(client, db, admin_identity, make_identity):
    disabled = make_identity(email="disabled@aegisnexus.ai", name="Disabled", status="DISABLED")
    resource = make_resource(db, allowed_roles=["EMPLOYEE", "SECURITY_ADMIN"])
    device = make_device(db, disabled)
    csrf = login(client, admin_identity.email)

    response = post_decision(
        client, csrf, resource, device, identity_id=disabled.id, simulate=True
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["decision"] == "DENY"
    assert "ACCOUNT_DISABLED" in {reason["code"] for reason in body["reasons"]}


def test_employee_cannot_evaluate_access_for_another_identity(
    client, db, employee_identity, admin_identity
):
    resource = make_resource(db)
    device = make_device(db, admin_identity)
    csrf = login(client, employee_identity.email)

    response = post_decision(client, csrf, resource, device, identity_id=admin_identity.id)
    assert response.status_code == 403


def test_auditor_has_read_only_access(client, db, auditor_identity):
    resource = make_resource(db)
    csrf = login(client, auditor_identity.email)

    response = post_decision(client, csrf, resource)
    assert response.status_code == 403
    assert client.get("/api/access-requests").status_code == 200


def test_risk_above_challenge_threshold_requires_step_up(client, db, employee_identity):
    resource = make_resource(db, deny_threshold=100)
    device = make_device(db, employee_identity)
    csrf = login(client, employee_identity.email)

    response = post_decision(client, csrf, resource, device, features=ANOMALOUS_FEATURES)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["decision"] == "CHALLENGE"
    assert body["risk_score"] >= 55
    assert "RISK_POLICY_CHALLENGE" in {reason["code"] for reason in body["reasons"]}


def test_device_ownership_mismatch_is_denied(client, db, employee_identity, admin_identity):
    resource = make_resource(db)
    admin_device = make_device(db, admin_identity)
    add_session(db, employee_identity)
    csrf = login(client, admin_identity.email)

    response = post_decision(
        client,
        csrf,
        resource,
        admin_device,
        identity_id=employee_identity.id,
        simulate=True,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["decision"] == "DENY"
    assert "DEVICE_OWNERSHIP_MISMATCH" in {reason["code"] for reason in body["reasons"]}


def test_repeated_high_risk_events_restrict_access_and_revoke_sessions(
    client, db, employee_identity
):
    resource = make_resource(db)
    device = make_device(db, employee_identity)
    csrf = login(client, employee_identity.email)
    for index in range(3):
        db.add(
            BehavioralEvent(
                id=new_id(),
                identity_id=employee_identity.id,
                device_id=device.id,
                features=NORMAL_FEATURES,
                anomaly_score=-0.2,
                risk_score=86.0,
                risk_category="CRITICAL",
                feature_summary=[],
                model_version="test-model",
                detected_at=utcnow(),
                is_simulated=True,
            )
        )
    db.commit()

    response = post_decision(client, csrf, resource, device)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["decision"] == "RESTRICT"
    assert "REPEATED_ANOMALIES" in {reason["code"] for reason in body["reasons"]}
    assert client.get("/api/auth/me").status_code == 401


def test_resource_without_policy_is_denied_by_default(client, db, employee_identity):
    resource = make_resource(db, key="unconfigured-resource", with_policy=False)
    device = make_device(db, employee_identity)
    csrf = login(client, employee_identity.email)

    response = post_decision(client, csrf, resource, device)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["decision"] == "DENY"
    assert "NO_ACTIVE_POLICY" in {reason["code"] for reason in body["reasons"]}


def test_decision_writes_tamper_evident_audit(client, db, employee_identity):
    resource = make_resource(db)
    device = make_device(db, employee_identity)
    csrf = login(client, employee_identity.email)
    before = audit_count(db)

    response = post_decision(client, csrf, resource, device)
    assert response.status_code == 200

    db.expire_all()
    assert audit_count(db) > before
    actions = {row.action for row in db.scalars(select(AuditLog))}
    assert "ACCESS_DECISION" in actions


def test_csv_export_requires_staff_and_is_audited(client, db, employee_identity, admin_identity):
    resource = make_resource(db)
    device = make_device(db, employee_identity)
    employee_csrf = login(client, employee_identity.email)
    assert post_decision(client, employee_csrf, resource, device).status_code == 200
    assert client.get("/api/access-requests/export.csv").status_code == 403

    login(client, admin_identity.email)
    export = client.get("/api/access-requests/export.csv")
    assert export.status_code == 200
    assert "request_id,timestamp,identity" in export.text
    assert "finance-reports" in export.text

    db.expire_all()
    actions = {row.action for row in db.scalars(select(AuditLog))}
    assert "EXPORT_ACCESS_REQUESTS" in actions
