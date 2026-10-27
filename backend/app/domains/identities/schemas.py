from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict

from app.domains.access.schemas import AccessRequestOut
from app.domains.audit.schemas import AuditOut
from app.domains.devices.schemas import DeviceOut
from app.domains.events.schemas import SecurityEventOut


class IdentitySummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    display_name: str
    email: str
    role: str
    status: str
    department: str
    title: str
    current_risk: float
    last_activity_at: datetime | None
    is_simulated: bool


class SessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime
    expires_at: datetime
    ip_address: str | None
    user_agent: str | None
    is_simulated: bool


class RiskPoint(BaseModel):
    timestamp: datetime
    risk_score: float
    risk_category: str
    source: str


class BehavioralSignalOut(BaseModel):
    id: str
    detected_at: datetime
    risk_score: float
    risk_category: str
    model_version: str
    top_factors: list[dict[str, Any]]
    is_simulated: bool


class IdentityDetail(IdentitySummary):
    created_at: datetime
    active_sessions: int
    sessions: list[SessionOut]
    devices: list[DeviceOut]
    recent_access: list[AccessRequestOut]
    behavioral_signals: list[BehavioralSignalOut]
    risk_history: list[RiskPoint]
    alerts: list[SecurityEventOut]
    audit_events: list[AuditOut]
