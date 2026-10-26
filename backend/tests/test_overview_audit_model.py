from __future__ import annotations

from sqlalchemy import select, text

from app.ml.runtime import ensure_model
from app.models import (
    AccessPolicy,
    AccessRequest,
    BehavioralEvent,
    Device,
    Resource,
    new_id,
    utcnow,
)
from app.services.events import record_event
from tests.conftest import login


def make_context(db, identity):
    resource = Resource(
        key="finance-reports",
        name="Finance Reports",
        description="",
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
            allowed_roles=["SECURITY_ADMIN"],
            allowed_device_states=["TRUSTED"],
            challenge_threshold=55,
            deny_threshold=95,
            session_max_minutes=60,
            is_simulated=True,
        )
    )
    device = Device(
        identity_id=identity.id,
        name="Admin laptop",
        device_type="Laptop",
        operating_system="Windows 11",
        state="TRUSTED",
        enrollment_status="ENROLLED",
        is_simulated=True,
    )
    db.add(device)
    db.commit()
    db.refresh(resource)
    db.refresh(device)
    return resource, device


def add_request(db, identity, resource, device, *, decision, risk, category):
    event = BehavioralEvent(
        identity_id=identity.id,
        device_id=device.id,
        features={},
        anomaly_score=-0.2,
        risk_score=risk,
        risk_category=category,
        feature_summary=[{"feature": "requests_1h", "label": "Request volume"}],
        model_version="test-model",
        detected_at=utcnow(),
        is_simulated=True,
    )
    db.add(event)
    db.flush()
    row = AccessRequest(
        identity_id=identity.id,
        resource_id=resource.id,
        device_id=device.id,
        behavioral_event_id=event.id,
        requested_action="READ",
        decision=decision,
        risk_score=risk,
        risk_category=category,
        anomaly_score=-0.2,
        policy_version="finance-reports:v1",
        reasons=[{"code": "TEST", "message": "Test decision", "severity": "INFO"}],
        recommended_action="Test",
        correlation_id=new_id(),
        created_at=utcnow(),
        is_simulated=True,
    )
    db.add(row)
    db.commit()
    return row


def test_overview_aggregates_posture(client, db, admin_identity):
    ensure_model()
    resource, device = make_context(db, admin_identity)
    admin_identity.current_risk = 88
    db.commit()
    add_request(db, admin_identity, resource, device, decision="DENY", risk=96, category="CRITICAL")
    add_request(db, admin_identity, resource, device, decision="ALLOW", risk=12, category="LOW")
    record_event(
        db,
        event_type="ACCESS_DENIED",
        category="Access",
        summary="High-risk access denied",
        correlation_id=new_id(),
        severity="CRITICAL",
        identity_id=admin_identity.id,
        device_id=device.id,
        details={"risk_score": 96},
        is_simulated=True,
    )
    db.commit()
    login(client, admin_identity.email)

    response = client.get("/api/overview?range_hours=24")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["range_hours"] == 24
    assert body["metrics"]["access_requests"] == 2
    assert body["metrics"]["denied_requests"] == 1
    assert body["metrics"]["high_risk_requests"] == 1
    assert body["metrics"]["model_analyzed_events"] == 2
    assert body["metrics"]["model_anomaly_rate"] == 50.0
    assert body["decision_breakdown"][3]["value"] == 1
    assert body["risk_distribution"][3]["value"] == 1
    assert body["identity_leaderboard"][0]["identity_id"] == admin_identity.id
    assert body["health"]["model"] == "available"
    assert len(body["timeline"]) >= 1


def test_audit_list_verify_and_export(client, db, admin_identity):
    csrf = login(client, admin_identity.email)
    response = client.get("/api/audit")
    assert response.status_code == 200, response.text
    assert response.json()["total"] >= 1
    assert response.json()["items"][0]["sequence"] >= 1

    verify = client.get("/api/audit/verify")
    assert verify.status_code == 200
    assert verify.json()["valid"] is True

    export = client.get("/api/audit/export.csv")
    assert export.status_code == 200
    assert "sequence,timestamp,actor,action" in export.text
    assert "LOGIN_SUCCESS" in export.text

    verify_after = client.get("/api/audit/verify")
    assert verify_after.json()["valid"] is True
    assert verify_after.json()["checked_records"] > verify.json()["checked_records"]


def test_audit_verification_detects_raw_tampering(client, db, admin_identity):
    login(client, admin_identity.email)
    assert client.get("/api/audit/verify").json()["valid"] is True
    db.execute(text("UPDATE audit_logs SET actor_label = 'tampered' WHERE sequence = 1"))
    db.commit()

    verify = client.get("/api/audit/verify")
    assert verify.status_code == 200
    assert verify.json()["valid"] is False
    assert verify.json()["first_invalid_id"]


def test_model_evaluation_and_feature_metadata(client, admin_identity, employee_identity):
    ensure_model()
    login(client, admin_identity.email)
    evaluation = client.get("/api/model/evaluation")
    assert evaluation.status_code == 200, evaluation.text
    body = evaluation.json()
    assert body["artifact_available"] is True
    assert body["metrics"]["precision"] > 0
    assert 0 <= body["metrics"]["false_positive_rate"] <= 1
    assert len(body["feature_names"]) == 10
    assert body["confusion_matrix"]["true_negative"] >= 0

    features = client.get("/api/model/features")
    assert features.status_code == 200
    assert len(features.json()) == 10
    assert {item["name"] for item in features.json()} >= {"requests_1h", "geo_novelty"}

    login(client, employee_identity.email)
    assert client.get("/api/model/evaluation").status_code == 403


def test_settings_info_requires_staff(client, admin_identity, employee_identity):
    login(client, admin_identity.email)
    response = client.get("/api/settings/info")
    assert response.status_code == 200
    assert response.json()["environment"] == "test"
    assert response.json()["demo_mode"] is True

    login(client, employee_identity.email)
    assert client.get("/api/settings/info").status_code == 403
