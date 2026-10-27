from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class AccessRequestOut(BaseModel):
    id: str
    identity_id: str
    identity_name: str
    identity_email: str
    resource_id: str
    resource_name: str
    resource_key: str
    device_id: str | None
    device_name: str | None
    requested_action: str
    decision: str
    risk_score: float
    risk_category: str
    anomaly_score: float
    policy_version: str
    recommended_action: str
    created_at: datetime
    is_simulated: bool


class ReasonOut(BaseModel):
    code: str
    message: str
    severity: str = "INFO"


class AccessRequestDetail(AccessRequestOut):
    reasons: list[dict[str, Any]]
    correlation_id: str
    model_version: str | None = None
    feature_summary: list[dict[str, Any]] = Field(default_factory=list)
    features: dict[str, Any] = Field(default_factory=dict)


class BehaviorFeatures(BaseModel):
    login_hour: int = Field(ge=0, le=23)
    day_of_week: int = Field(ge=0, le=6)
    failed_logins_15m: int = Field(ge=0, le=100)
    requests_1h: int = Field(ge=0, le=1000)
    distinct_resources_1h: int = Field(ge=0, le=100)
    sensitive_access_ratio: float = Field(ge=0, le=1)
    new_device: bool
    geo_novelty: bool
    session_duration_min: float = Field(ge=0, le=1440)
    activity_deviation: float = Field(ge=0, le=10)


class EvaluateAccessIn(BaseModel):
    identity_id: str | None = None
    resource_id: str
    device_id: str | None = None
    requested_action: Literal["READ", "WRITE", "DELETE", "ADMIN"] = "READ"
    features: BehaviorFeatures
    simulate: bool = False


class DecisionOut(BaseModel):
    request_id: str
    identity_id: str
    resource_id: str
    requested_action: str
    decision: str
    risk_category: str
    risk_score: float
    anomaly_score: float
    policy_version: str
    reasons: list[dict[str, Any]]
    recommended_next_step: str
    timestamp: datetime
    correlation_id: str
    is_simulated: bool
