from __future__ import annotations

from datetime import datetime
from typing import Any, Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int


class ErrorBody(BaseModel):
    code: str
    message: str
    details: Any | None = None


class ErrorResponse(BaseModel):
    error: ErrorBody


class LoginIn(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=256)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class MeOut(BaseModel):
    id: str
    display_name: str
    email: str
    role: str
    status: str
    department: str
    title: str
    current_risk: float
    csrf_token: str
    session_expires_at: datetime
    demo_mode: bool


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


class DeviceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    identity_id: str
    identity_name: str | None = None
    name: str
    device_type: str
    operating_system: str
    state: str
    enrollment_status: str
    last_observed_at: datetime | None
    enrolled_at: datetime
    revoked_at: datetime | None
    signals: dict[str, Any]
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


class IdentityDetail(IdentitySummary):
    created_at: datetime
    active_sessions: int
    sessions: list[SessionOut]
    devices: list[DeviceOut]
    recent_access: list[AccessRequestOut]
    behavioral_signals: list[BehavioralSignalOut]
    risk_history: list[RiskPoint]
    alerts: list["SecurityEventOut"]
    audit_events: list["AuditOut"]


class ResourceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    key: str
    name: str
    description: str
    sensitivity: str
    owner_department: str
    is_active: bool
    is_simulated: bool


class PolicyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    resource_id: str
    version: int
    allowed_roles: list[str]
    allowed_device_states: list[str]
    challenge_threshold: int
    deny_threshold: int
    require_additional_verification: bool
    session_max_minutes: int
    is_active: bool
    created_by: str | None
    created_at: datetime
    change_reason: str
    is_simulated: bool


class ResourcePolicyOut(ResourceOut):
    policy: PolicyOut | None
    version_count: int


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


class AuditOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    sequence: int
    timestamp: datetime
    actor_id: str | None
    actor_label: str
    action: str
    target_type: str
    target_id: str | None
    result: str
    policy_version: str | None
    correlation_id: str
    metadata_json: dict[str, Any]
    prev_hash: str
    record_hash: str


class AuditVerifyOut(BaseModel):
    valid: bool
    checked_records: int
    first_invalid_id: str | None = None
    message: str


class DeviceEnrollIn(BaseModel):
    identity_id: str
    name: str = Field(min_length=2, max_length=120)
    device_type: Literal["Laptop", "Desktop", "Mobile", "Tablet", "Virtual Machine"]
    operating_system: str = Field(min_length=2, max_length=80)
    initial_state: Literal["TRUSTED", "UNVERIFIED"] = "UNVERIFIED"


class DeviceStateIn(BaseModel):
    state: Literal["TRUSTED", "UNVERIFIED", "RESTRICTED", "REVOKED"]
    reason: str = Field(min_length=3, max_length=500)


class PolicyUpdateIn(BaseModel):
    allowed_roles: list[str] = Field(min_length=1)
    allowed_device_states: list[str] = Field(min_length=1)
    challenge_threshold: int = Field(ge=0, le=100)
    deny_threshold: int = Field(ge=0, le=100)
    require_additional_verification: bool = True
    session_max_minutes: int = Field(ge=5, le=480)
    reason: str = Field(min_length=5, max_length=1000)
    is_active: bool = True

    @field_validator("allowed_roles")
    @classmethod
    def valid_roles(cls, values: list[str]) -> list[str]:
        allowed = {"SECURITY_ADMIN", "SECURITY_ANALYST", "EMPLOYEE", "AUDITOR"}
        unknown = set(values) - allowed
        if unknown:
            raise ValueError(f"unknown roles: {sorted(unknown)}")
        return sorted(set(values))

    @field_validator("allowed_device_states")
    @classmethod
    def valid_states(cls, values: list[str]) -> list[str]:
        allowed = {"TRUSTED", "UNVERIFIED", "RESTRICTED"}
        unknown = set(values) - allowed
        if unknown:
            raise ValueError(f"unknown device states: {sorted(unknown)}")
        return sorted(set(values))

    @model_validator(mode="after")
    def thresholds_are_ordered(self):
        if self.challenge_threshold >= self.deny_threshold:
            raise ValueError("challenge_threshold must be lower than deny_threshold")
        return self


class PolicyPreviewCase(BaseModel):
    role: Literal["SECURITY_ADMIN", "SECURITY_ANALYST", "EMPLOYEE", "AUDITOR"]
    device_state: Literal["TRUSTED", "UNVERIFIED", "RESTRICTED", "REVOKED"]
    risk_score: float = Field(ge=0, le=100)
    account_active: bool = True
    identity_authorized: bool = True
    session_active: bool = True
    repeated_anomalies: int = Field(default=0, ge=0, le=20)


class PolicyPreviewIn(BaseModel):
    draft: PolicyUpdateIn
    cases: list[PolicyPreviewCase] = Field(min_length=1, max_length=50)


class PolicyPreviewResult(BaseModel):
    case_index: int
    decision: str
    reasons: list[dict[str, Any]]


class PolicyPreviewOut(BaseModel):
    policy_version_preview: str
    results: list[PolicyPreviewResult]
    persisted: Literal[False] = False


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


class HealthStatus(BaseModel):
    api: str
    database: str
    model: str
    event_stream: str
    model_version: str | None = None
    stream_clients: int = 0
    checked_at: datetime


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


class NotificationOut(BaseModel):
    id: str
    title: str
    severity: str
    timestamp: datetime
    event_type: str
    link: str


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


IdentityDetail.model_rebuild()
IncidentDetail.model_rebuild()
