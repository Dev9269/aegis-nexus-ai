from __future__ import annotations

import os
import tempfile
from pathlib import Path

TEST_DB = Path(tempfile.mkdtemp(prefix="aegis-test-")) / "aegis-test.db"
TEST_ARTIFACTS = Path(tempfile.mkdtemp(prefix="aegis-artifacts-"))

os.environ.setdefault("AEGIS_ENVIRONMENT", "test")
os.environ.setdefault("AEGIS_DATABASE_URL", f"sqlite:///{TEST_DB.as_posix()}")
os.environ.setdefault("AEGIS_DEMO_MODE", "true")
os.environ.setdefault("AEGIS_DEMO_PASSWORD", "Test-Demo!2026")
os.environ.setdefault("AEGIS_MODEL_ARTIFACT_DIR", str(TEST_ARTIFACTS))
os.environ.setdefault("AEGIS_COOKIE_SECURE", "false")

import pytest
from fastapi.testclient import TestClient

from app.api.deps import login_limiter
from app.core.database import Base, SessionLocal, engine
from app.models import Identity, Role
from app.security.passwords import hash_password
from app.security.tokens import new_csrf_token


@pytest.fixture(scope="session", autouse=True)
def database_schema():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(autouse=True)
def clean_database(database_schema):
    from app import models  # noqa: F401

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    login_limiter.reset()
    yield


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client():
    from app.main import create_app

    with TestClient(create_app()) as test_client:
        yield test_client


@pytest.fixture
def make_identity(db):
    def _make(
        *,
        email: str = "admin@aegisnexus.ai",
        name: str = "Admin",
        role: str = Role.SECURITY_ADMIN.value,
        password: str = "Test-Demo!2026",
        status: str = "ACTIVE",
    ) -> Identity:
        identity = Identity(
            display_name=name,
            email=email,
            password_hash=hash_password(password),
            role=role,
            status=status,
            department="Security",
            title="Test Identity",
            is_simulated=True,
        )
        db.add(identity)
        db.commit()
        db.refresh(identity)
        return identity

    return _make


def login(client: TestClient, email: str, password: str = "Test-Demo!2026") -> str:
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return response.json()["csrf_token"]


@pytest.fixture
def admin_identity(make_identity):
    return make_identity()


@pytest.fixture
def analyst_identity(make_identity):
    return make_identity(
        email="analyst@aegisnexus.ai", name="Analyst", role=Role.SECURITY_ANALYST.value
    )


@pytest.fixture
def employee_identity(make_identity):
    return make_identity(
        email="employee@aegisnexus.ai", name="Employee", role=Role.EMPLOYEE.value
    )


@pytest.fixture
def auditor_identity(make_identity):
    return make_identity(
        email="auditor@aegisnexus.ai", name="Auditor", role=Role.AUDITOR.value
    )


@pytest.fixture
def csrf_headers():
    def _headers(token: str) -> dict[str, str]:
        return {"X-CSRF-Token": token}

    return _headers
