from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel

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
from app.domains.demo.schemas import (  # noqa: F401  # TEMP-COMPAT
    DemoResetOut,
    DemoRunOut,
    DemoScenarioInfo,
    DemoScenarioOut,
)
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
from app.domains.incidents.schemas import (  # noqa: F401  # TEMP-COMPAT
    IncidentDetail,
    IncidentNoteIn,
    IncidentNoteOut,
    IncidentOut,
    IncidentUpdateIn,
)
from app.domains.model.schemas import (  # noqa: F401  # TEMP-COMPAT
    ConfusionMatrix,
    ModelEvaluationOut,
    ModelMetricSet,
)
from app.domains.overview.schemas import (  # noqa: F401  # TEMP-COMPAT
    NamedCount,
    OverviewMetrics,
    OverviewOut,
    RiskLeader,
    TimelinePoint,
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
