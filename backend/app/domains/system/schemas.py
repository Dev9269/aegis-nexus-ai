from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class HealthStatus(BaseModel):
    api: str
    database: str
    model: str
    event_stream: str
    model_version: str | None = None
    stream_clients: int = 0
    checked_at: datetime


class SettingsInfoOut(BaseModel):
    environment: str
    demo_mode: bool
    session_ttl_minutes: int
    login_rate_limit: int
    login_rate_window_seconds: int
    allowed_origins: list[str]
    model_artifact_available: bool
    model_version: str | None
    limitations: list[str]
