from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class DemoScenarioInfo(BaseModel):
    scenario: str
    title: str
    description: str
    expected_outcome: str
    subject: str
    resource: str
    device: str | None = None


class DemoScenarioOut(BaseModel):
    scenario: str
    title: str
    description: str
    expected_outcome: str
    actual_outcome: str
    passed: bool
    request_id: str | None = None
    incident_id: str | None = None
    decision: str | None = None
    risk_score: float | None = None
    details: dict[str, Any] = Field(default_factory=dict)


class DemoRunOut(BaseModel):
    scenario: str | None
    results: list[DemoScenarioOut]
    executed_at: datetime
    demo_mode: bool
    is_simulated: Literal[True] = True


class DemoResetOut(BaseModel):
    reset: bool
    identities: int
    devices: int
    access_requests: int
    incidents: int
    message: str
