from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.api.schemas import ErrorBody, ErrorResponse, Page  # noqa: F401  # TEMP-COMPAT
from app.domains.access.schemas import (  # noqa: F401  # TEMP-COMPAT
    AccessRequestDetail,
    AccessRequestOut,
    BehaviorFeatures,
    DecisionOut,
    EvaluateAccessIn,
    ReasonOut,
)
from app.domains.audit.schemas import AuditOut, AuditVerifyOut  # noqa: F401  # TEMP-COMPAT
from app.domains.auth.schemas import LoginIn, MeOut  # noqa: F401  # TEMP-COMPAT
from app.domains.devices.schemas import (  # noqa: F401  # TEMP-COMPAT
    DeviceEnrollIn,
    DeviceOut,
    DeviceStateIn,
)
from app.domains.events.schemas import NotificationOut, SecurityEventOut  # noqa: F401  # TEMP-COMPAT
from app.domains.identities.schemas import (  # noqa: F401  # TEMP-COMPAT
    BehavioralSignalOut,
    IdentityDetail,
    IdentitySummary,
    RiskPoint,
    SessionOut,
)
from app.domains.policies.schemas import (  # noqa: F401  # TEMP-COMPAT
    PolicyOut,
    PolicyPreviewCase,
    PolicyPreviewIn,
    PolicyPreviewOut,
    PolicyPreviewResult,
    PolicyUpdateIn,
    ResourceOut,
    ResourcePolicyOut,
)
from app.domains.system.schemas import HealthStatus, SettingsInfoOut  # noqa: F401  # TEMP-COMPAT


class PredictionOut(BaseModel):
    anomaly_score: float
    risk_score: float
    risk_category: str
    model_version: str
    detection_timestamp: datetime
    feature_summary: list[dict[str, Any]]
    limitations: list[str]
    score_interpretation: str


class BehavioralEventOut(BaseModel):
    id: str
    identity_id: str
    identity_name: str | None
    device_id: str | None
    features: dict[str, Any]
    anomaly_score: float
    risk_score: float
    risk_category: str
    feature_summary: list[dict[str, Any]]
    model_version: str
    detected_at: datetime
    is_simulated: bool


class IncidentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    classification: str
    severity: str
    status: str
    identity_id: str | None
    identity_name: str | None = None
    summary: str
    assigned_to: str | None
    related_access_request_ids: list[str]
    related_device_ids: list[str]
    resolution: str | None
    created_at: datetime
    updated_at: datetime
    is_simulated: bool


class IncidentNoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    author_label: str
    note: str
    created_at: datetime


class IncidentDetail(IncidentOut):
    notes: list[IncidentNoteOut]
    timeline: list["SecurityEventOut"]
    access_requests: list[AccessRequestOut]


class IncidentUpdateIn(BaseModel):
    status: Literal[
        "OPEN", "INVESTIGATING", "CONTAINED", "RESOLVED", "FALSE_POSITIVE"
    ] | None = None
    severity: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"] | None = None
    assigned_to: str | None = None
    resolution: str | None = Field(default=None, max_length=2000)
    note: str | None = Field(default=None, max_length=2000)


class IncidentNoteIn(BaseModel):
    note: str = Field(min_length=1, max_length=2000)


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


class ModelMetricSet(BaseModel):
    precision: float
    recall: float
    f1: float
    false_positive_rate: float
    roc_auc: float | None
    threshold: float


class ConfusionMatrix(BaseModel):
    true_negative: int
    false_positive: int
    false_negative: int
    true_positive: int


class ModelEvaluationOut(BaseModel):
    model_version: str
    model_type: str
    trained_at: datetime
    evaluated_at: datetime
    seed: int
    feature_names: list[str]
    train_rows: int
    test_rows: int
    label_distribution: dict[str, int]
    metrics: ModelMetricSet
    confusion_matrix: ConfusionMatrix
    dataset_description: str
    score_interpretation: str
    limitations: list[str]
    artifact_available: bool


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


IncidentDetail.model_rebuild()
