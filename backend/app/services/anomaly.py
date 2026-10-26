from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.ml.runtime import ensure_model, predict
from app.models import BehavioralEvent, Identity, new_id

REPEATED_ANOMALY_WINDOW_MINUTES = 30
REPEATED_ANOMALY_RISK_THRESHOLD = 80.0


def analyze_behavior(
    db: Session,
    *,
    identity: Identity,
    device_id: str | None,
    features: dict[str, Any],
    is_simulated: bool,
) -> BehavioralEvent:
    ensure_model()
    prediction = predict(features)
    event = BehavioralEvent(
        id=new_id(),
        identity_id=identity.id,
        device_id=device_id,
        features=features,
        anomaly_score=prediction["anomaly_score"],
        risk_score=prediction["risk_score"],
        risk_category=prediction["risk_category"],
        feature_summary=prediction["feature_summary"],
        model_version=prediction["model_version"],
        detected_at=prediction["detection_timestamp"],
        is_simulated=is_simulated,
    )
    db.add(event)
    db.flush()
    return event
