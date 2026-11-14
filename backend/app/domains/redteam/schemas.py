from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class RedTeamAttack(BaseModel):
    name: str
    identity_email: str
    resource_name: str
    requested_action: str
    decision: str
    risk_score: float
    risk_category: str
    blocked: bool
    explanation: str
    confidence: float


class RedTeamScenario(BaseModel):
    id: str
    name: str
    description: str
    severity: str


class RedTeamScenarioResult(BaseModel):
    scenario: RedTeamScenario
    attacks: list[RedTeamAttack]
    blocked_count: int
    total_count: int
    defended: bool


class RedTeamRunOut(BaseModel):
    results: list[RedTeamScenarioResult]
    total_attacks: int
    blocked_attacks: int
    overall: str