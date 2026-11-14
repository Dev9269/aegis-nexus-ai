from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class LeakFindingOut(BaseModel):
    id: str
    identity_id: str | None
    identity_name: str | None = None
    source_type: str
    source_name: str
    severity: str
    matched_field: str
    leaked_value_masked: str
    first_seen: datetime
    last_seen: datetime
    status: str
    remediation: str
    is_simulated: bool


class LeakFindingUpdate(BaseModel):
    status: Literal["NEW", "TRIAGED", "RESOLVED", "FALSE_POSITIVE"]


class ThreatIntelSummary(BaseModel):
    total: int
    new: int
    triaged: int
    resolved: int
    critical: int
    high: int


class SimulateLeakOut(BaseModel):
    finding: LeakFindingOut
    incident_id: str | None = None
    message: str