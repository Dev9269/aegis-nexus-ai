from __future__ import annotations

from app.domains.system import service as system_service


def test_readiness_is_public_and_reports_checks(client):
    response = client.get("/api/health/ready")

    assert response.status_code == 200
    assert response.json()["status"] == "ready"
    assert response.json()["checks"] == {"database": "ok", "audit_chain": "ok"}


def test_readiness_fails_closed_when_database_is_unavailable(client, monkeypatch):
    monkeypatch.setattr(system_service, "database_is_available", lambda: False)

    response = client.get("/api/health/ready")

    assert response.status_code == 503
    assert response.json()["status"] == "not_ready"
    assert response.json()["checks"]["database"] == "unavailable"


def test_request_id_is_echoed_when_valid(client):
    response = client.get("/api/health", headers={"X-Request-ID": "trace-123"})

    assert response.headers["X-Request-ID"] == "trace-123"


def test_request_id_is_replaced_when_invalid(client):
    response = client.get("/api/health", headers={"X-Request-ID": "bad value with spaces"})

    assert response.headers["X-Request-ID"] != "bad value with spaces"
    assert len(response.headers["X-Request-ID"]) == 32
