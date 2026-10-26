from __future__ import annotations

import pytest
from sqlalchemy import select

from app.core.config import Settings
from app.models import AuditLog, Identity
from app.services.bootstrap import ensure_bootstrap_admin


def test_production_bootstrap_requires_admin_credentials(db):
    settings = Settings(
        _env_file=None,
        environment="test",
        demo_mode=False,
        bootstrap_admin_email=None,
        bootstrap_admin_password=None,
    )

    with pytest.raises(ValueError, match="bootstrap"):
        ensure_bootstrap_admin(db, settings)


def test_production_bootstrap_requires_a_strong_password(db):
    settings = Settings(
        _env_file=None,
        environment="test",
        demo_mode=False,
        bootstrap_admin_email="admin@aegis.example.com",
        bootstrap_admin_password="short",
    )

    with pytest.raises(ValueError, match="12 characters"):
        ensure_bootstrap_admin(db, settings)


def test_production_bootstrap_creates_only_an_admin(db):
    settings = Settings(
        _env_file=None,
        environment="test",
        demo_mode=False,
        bootstrap_admin_email="admin@aegis.example.com",
        bootstrap_admin_password="A-long-bootstrap-password-2026",
        bootstrap_admin_name="Bootstrap Admin",
    )

    assert ensure_bootstrap_admin(db, settings) is True

    identities = list(db.scalars(select(Identity)))
    assert len(identities) == 1
    assert identities[0].role == "SECURITY_ADMIN"
    assert identities[0].email == settings.bootstrap_admin_email
    assert identities[0].display_name == "Bootstrap Admin"
    assert any(audit.action == "BOOTSTRAP_ADMIN_CREATED" for audit in db.scalars(select(AuditLog)))


def test_bootstrap_is_idempotent(db):
    settings = Settings(
        _env_file=None,
        environment="test",
        demo_mode=False,
        bootstrap_admin_email="admin@aegis.example.com",
        bootstrap_admin_password="A-long-bootstrap-password-2026",
    )

    assert ensure_bootstrap_admin(db, settings) is True
    assert ensure_bootstrap_admin(db, settings) is False
    assert len(list(db.scalars(select(Identity)))) == 1
