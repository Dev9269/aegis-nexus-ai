from __future__ import annotations

from app.core.config.settings import Settings


def validate_runtime_settings(settings: Settings) -> None:
    if settings.is_development:
        return
    if not settings.cookie_secure:
        raise ValueError("AEGIS_COOKIE_SECURE must be true outside development.")
    if settings.demo_mode:
        raise ValueError("demo mode must be disabled outside development.")
    if "*" in settings.allowed_origin_list:
        raise ValueError("Wildcard CORS origins are not allowed outside development.")
