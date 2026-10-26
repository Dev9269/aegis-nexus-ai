from __future__ import annotations

from tests.conftest import login


def test_stale_session_cookie_still_requires_csrf(client, admin_identity):
    csrf = login(client, admin_identity.email)
    assert client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf}).status_code == 200

    client.cookies.set("aegis_session", "stale-session")
    client.cookies.set("aegis_csrf", "stale-csrf")
    response = client.post("/api/auth/logout")

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "CSRF_VALIDATION_FAILED"


def test_stale_session_with_matching_double_submit_reaches_auth(client, admin_identity):
    login(client, admin_identity.email)
    client.cookies.set("aegis_session", "stale-session")
    client.cookies.set("aegis_csrf", "stale-csrf")

    response = client.post("/api/auth/logout", headers={"X-CSRF-Token": "stale-csrf"})

    assert response.status_code == 401


def test_active_session_rejects_double_submit_not_bound_to_session(client, admin_identity):
    login(client, admin_identity.email)
    client.cookies.set("aegis_csrf", "attacker-token")

    response = client.post("/api/auth/logout", headers={"X-CSRF-Token": "attacker-token"})

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "CSRF_VALIDATION_FAILED"


def test_anonymous_unsafe_request_is_not_treated_as_csrf_failure(client):
    response = client.post("/api/auth/logout")

    assert response.status_code == 401
