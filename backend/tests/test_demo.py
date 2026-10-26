from __future__ import annotations

from sqlalchemy import select

from app.models import AuditLog
from app.seed import seed_demo_data
from tests.conftest import login


def test_demo_scenarios_execute_production_paths_and_false_positive_workflow(client, db):
    seed_demo_data(db)
    csrf = login(client, "admin@aegisnexus.ai")

    scenarios = client.get("/api/demo/scenarios")
    assert scenarios.status_code == 200
    assert [item["scenario"] for item in scenarios.json()] == ["A", "B", "C", "D", "E", "F"]

    response = client.post("/api/demo/run", headers={"X-CSRF-Token": csrf})
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["is_simulated"] is True
    assert payload["demo_mode"] is True

    results = {item["scenario"]: item for item in payload["results"]}
    assert set(results) == {"A", "B", "C", "D", "E", "F"}
    assert all(item["passed"] for item in results.values()), payload
    assert results["A"]["decision"] == "ALLOW"
    assert results["B"]["decision"] == "CHALLENGE"
    assert results["C"]["decision"] == "DENY"
    assert results["D"]["decision"] == "DENY"
    assert results["E"]["decision"] == "RESTRICT"
    assert results["F"]["decision"] == "DENY"
    assert results["F"]["incident_id"]

    e_attempts = [attempt["decision"] for attempt in results["E"]["details"]["attempts"]]
    assert e_attempts == ["CHALLENGE", "CHALLENGE", "RESTRICT"]

    detail = client.get(f"/api/access-requests/{results['F']['request_id']}")
    assert detail.status_code == 200
    reason_codes = {reason["code"] for reason in detail.json()["reasons"]}
    assert "RISK_POLICY_DENY" in reason_codes

    incident_id = results["F"]["incident_id"]
    update = client.patch(
        f"/api/incidents/{incident_id}",
        headers={"X-CSRF-Token": csrf},
        json={
            "status": "FALSE_POSITIVE",
            "resolution": "Reviewed simulated exfiltration pattern and confirmed benign test activity.",
            "note": "Demo false-positive review completed.",
        },
    )
    assert update.status_code == 200, update.text
    assert update.json()["status"] == "FALSE_POSITIVE"
    assert update.json()["resolution"]

    verify = client.get("/api/audit/verify")
    assert verify.status_code == 200
    assert verify.json()["valid"] is True

    actions = set(db.scalars(select(AuditLog.action)))
    assert "ACCESS_DECISION" in actions
    assert "DEMO_SCENARIO_RUN" in actions
    assert "INCIDENT_UPDATED" in actions


def test_demo_reset_recreates_simulated_data_and_preserves_audit_chain(client, db):
    seed_demo_data(db)
    csrf = login(client, "admin@aegisnexus.ai")
    before = len(list(db.scalars(select(AuditLog))))

    response = client.post("/api/demo/reset", headers={"X-CSRF-Token": csrf})
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["reset"] is True
    assert payload["identities"] == 12
    assert payload["devices"] == 14
    assert payload["incidents"] == 1

    after = len(list(db.scalars(select(AuditLog))))
    assert after > before
    assert client.get("/api/auth/me").status_code == 401

    csrf = login(client, "admin@aegisnexus.ai")
    rerun = client.post(
        "/api/demo/scenarios/A",
        headers={"X-CSRF-Token": csrf},
    )
    assert rerun.status_code == 200, rerun.text
    assert rerun.json()["results"][0]["passed"] is True
    assert client.get("/api/audit/verify").json()["valid"] is True


def test_demo_role_boundaries(client, db):
    seed_demo_data(db)

    analyst_csrf = login(client, "analyst@aegisnexus.ai")
    assert client.post(
        "/api/demo/scenarios/A", headers={"X-CSRF-Token": analyst_csrf}
    ).status_code == 200
    assert client.post(
        "/api/demo/reset", headers={"X-CSRF-Token": analyst_csrf}
    ).status_code == 403

    auditor_csrf = login(client, "auditor@aegisnexus.ai")
    assert client.get("/api/demo/scenarios").status_code == 200
    assert client.post(
        "/api/demo/run", headers={"X-CSRF-Token": auditor_csrf}
    ).status_code == 403

    employee_csrf = login(client, "maya.chen@aegisnexus.ai")
    assert client.get("/api/demo/scenarios").status_code == 403
    assert client.post(
        "/api/demo/run", headers={"X-CSRF-Token": employee_csrf}
    ).status_code == 403
