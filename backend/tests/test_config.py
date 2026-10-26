from __future__ import annotations

import pytest

from app.core.config import Settings, validate_runtime_settings


def test_production_rejects_insecure_cookies():
    settings = Settings(
        _env_file=None,
        environment="production",
        demo_mode=False,
        cookie_secure=False,
        allowed_origins="https://aegis.example.com",
    )

    with pytest.raises(ValueError, match="AEGIS_COOKIE_SECURE"):
        validate_runtime_settings(settings)


def test_production_rejects_demo_mode():
    settings = Settings(
        _env_file=None,
        environment="production",
        demo_mode=True,
        cookie_secure=True,
        allowed_origins="https://aegis.example.com",
    )

    with pytest.raises(ValueError, match="demo mode"):
        validate_runtime_settings(settings)


def test_production_rejects_wildcard_cors():
    settings = Settings(
        _env_file=None,
        environment="production",
        demo_mode=False,
        cookie_secure=True,
        allowed_origins="*",
    )

    with pytest.raises(ValueError, match="Wildcard"):
        validate_runtime_settings(settings)


def test_valid_production_configuration_passes():
    settings = Settings(
        _env_file=None,
        environment="production",
        demo_mode=False,
        cookie_secure=True,
        allowed_origins="https://aegis.example.com",
        bootstrap_admin_email="admin@aegis.example.com",
        bootstrap_admin_password="A-long-bootstrap-password-2026",
    )

    validate_runtime_settings(settings)
