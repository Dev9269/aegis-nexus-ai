from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class SecurityEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    event_type: str
    category: str
    severity: str
    summary: str
    identity_id: str | None
    device_id: str | None
    access_request_id: str | None
    incident_id: str | None
    actor_id: str | None
    policy_version: str | None
    correlation_id: str
    details: dict[str, Any]
    timestamp: datetime
    is_simulated: bool


class NotificationOut(BaseModel):
    id: str
    title: str
    severity: str
    timestamp: datetime
    event_type: str
    link: str
