from __future__ import annotations

from tests.conftest import login


def test_unknown_route_keeps_starlette_404_shape(client):
    response = client.get("/api/not-a-real-route")
    assert response.status_code == 404
    assert response.json() == {"detail": "Not Found"}


def test_unauthenticated_known_route_uses_error_envelope(client):
    response = client.get("/api/auth/me")
    assert response.status_code == 401
    assert response.json() == {
        "error": {
            "code": "NOT_AUTHENTICATED",
            "message": "Authentication is required.",
            "details": None,
        }
    }


def test_employee_cannot_read_staff_surfaces(client, employee_identity):
    login(client, employee_identity.email)
    assert client.get("/api/audit").status_code == 403
    assert client.get("/api/incidents").status_code == 403


def test_auditor_cannot_evaluate_access(client, auditor_identity):
    csrf = login(client, auditor_identity.email)
    response = client.post(
        "/api/access-requests/evaluate",
        headers={"X-CSRF-Token": csrf},
        json={
            "identity_id": auditor_identity.id,
            "resource_id": "missing-resource",
            "requested_action": "READ",
            "features": {
                "login_hour": 9,
                "day_of_week": 1,
                "failed_logins_15m": 0,
                "requests_1h": 1,
                "distinct_resources_1h": 1,
                "sensitive_access_ratio": 0,
                "new_device": False,
                "geo_novelty": False,
                "session_duration_min": 10,
                "activity_deviation": 0,
            },
        },
    )
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "FORBIDDEN"
