from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from app.domains.events.schemas import SecurityEventOut
from app.domains.system.schemas import HealthStatus


class OverviewMetrics(BaseModel):
    total_identities: int
    active_sessions: int
    access_requests: int
    suspicious_events: int
    high_risk_requests: int
    denied_requests: int
    challenged_requests: int
    model_analyzed_events: int
    model_anomaly_rate: float
    model_version: str
    demo_events: int
    real_events: int


class TimelinePoint(BaseModel):
    bucket: str
    access_requests: int
    security_events: int
    high_risk: int


class NamedCount(BaseModel):
    name: str
    value: int


class RiskLeader(BaseModel):
    identity_id: str
    identity_name: str
    role: str
    risk_score: float
    anomaly_count: int


class OverviewOut(BaseModel):
    range_hours: int
    range_label: str
    generated_at: datetime
    metrics: OverviewMetrics
    timeline: list[TimelinePoint]
    risk_distribution: list[NamedCount]
    decision_breakdown: list[NamedCount]
    identity_leaderboard: list[RiskLeader]
    recent_events: list[SecurityEventOut]
    health: HealthStatus
