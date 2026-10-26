from __future__ import annotations

from sqlalchemy import select

from app.models import AuditLog, SecurityEvent, UserSession
from tests.conftest import login


def test_login_sets_session_and_returns_identity(client, admin_identity):
    csrf = login(client, admin_identity.email)
    assert csrf
    assert client.cookies.get("aegis_session")
    assert client.cookies.get("aegis_csrf") == csrf

    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == admin_identity.email
    assert me.json()["role"] == "SECURITY_ADMIN"


def test_wrong_password_is_rejected_and_logged(client, admin_identity, db):
    response = client.post(
        "/api/auth/login",
        json={"email": admin_identity.email, "password": "not-the-password"},
    )
    assert response.status_code == 401
    assert response.json()["error"]["message"] == "Invalid email or password."

    events = list(db.scalars(select(SecurityEvent)))
    assert any(event.event_type == "AUTH_FAILURE" for event in events)
    audits = list(db.scalars(select(AuditLog)))
    assert any(audit.action == "LOGIN_FAILED" for audit in audits)


def test_disabled_identity_cannot_login(client, make_identity):
    identity = make_identity(email="disabled@aegisnexus.ai", status="DISABLED")
    response = client.post(
        "/api/auth/login",
        json={"email": identity.email, "password": "Test-Demo!2026"},
    )
    assert response.status_code == 401


def test_anonymous_me_is_rejected(client):
    response = client.get("/api/auth/me")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "NOT_AUTHENTICATED"


def test_logout_requires_csrf_and_revokes_session(client, admin_identity, csrf_headers, db):
    csrf = login(client, admin_identity.email)
    without_csrf = client.post("/api/auth/logout")
    assert without_csrf.status_code == 403

    logout = client.post("/api/auth/logout", headers=csrf_headers(csrf))
    assert logout.status_code == 200
    assert client.get("/api/auth/me").status_code == 401
    assert all(session.revoked_at is not None for session in db.scalars(select(UserSession)))
