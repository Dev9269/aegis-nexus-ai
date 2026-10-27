from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import AuthContext, require_roles
from app.audit.service import append_audit
from app.core.database import get_db
from app.core.errors import ApiError
from app.core.roles import ADMIN_ROLES, STAFF_ROLES
from app.ml.runtime import (
    feature_metadata,
    get_evaluation,
    get_metadata,
    model_available,
    retrain,
)
from app.models import new_id
from app.schemas import (
    ConfusionMatrix,
    ModelEvaluationOut,
    ModelMetricSet,
)
from app.services.events import record_event

router = APIRouter(prefix="/model", tags=["model"])


def _evaluation_payload() -> ModelEvaluationOut:
    if not model_available():
        raise ApiError(
            503,
            "MODEL_UNAVAILABLE",
            "The anomaly detection model artifact is not available.",
        )
    metadata = get_metadata()
    evaluation = get_evaluation()
    metrics = evaluation["metrics"]
    return ModelEvaluationOut(
        model_version=metadata["model_version"],
        model_type=metadata["model_type"],
        trained_at=datetime.fromisoformat(metadata["trained_at"]),
        evaluated_at=datetime.fromisoformat(evaluation["evaluated_at"]),
        seed=int(metadata["seed"]),
        feature_names=list(metadata["feature_names"]),
        train_rows=int(evaluation["train_rows"]),
        test_rows=int(evaluation["test_rows"]),
        label_distribution={
            key: int(value) for key, value in evaluation["label_distribution"].items()
        },
        metrics=ModelMetricSet(**metrics),
        confusion_matrix=ConfusionMatrix(**evaluation["confusion_matrix"]),
        dataset_description=evaluation["dataset_description"],
        score_interpretation=evaluation["score_interpretation"],
        limitations=list(evaluation["limitations"]),
        artifact_available=True,
    )


@router.get("/evaluation", response_model=ModelEvaluationOut)
def model_evaluation(
    auth: AuthContext = Depends(require_roles(*STAFF_ROLES)),
) -> ModelEvaluationOut:
    return _evaluation_payload()


@router.get("/features")
def model_features(
    auth: AuthContext = Depends(require_roles(*STAFF_ROLES)),
) -> list[dict]:
    return feature_metadata()


@router.post("/retrain", response_model=ModelEvaluationOut)
def retrain_model(
    seed: int = Query(default=42, ge=1, le=100000),
    rows: int = Query(default=5000, ge=1000, le=50000),
    auth: AuthContext = Depends(require_roles(*ADMIN_ROLES)),
    db: Session = Depends(get_db),
) -> ModelEvaluationOut:
    result = retrain(seed=seed, rows=rows)
    correlation_id = new_id()
    append_audit(
        db,
        actor=auth.identity,
        action="MODEL_RETRAINED",
        target_type="model",
        target_id=result["model_version"],
        correlation_id=correlation_id,
        result="SUCCESS",
        metadata={
            "seed": seed,
            "rows": rows,
            "metrics": result["metrics"],
        },
    )
    record_event(
        db,
        event_type="MODEL_RETRAINED",
        category="Model",
        summary=f"Anomaly model retrained: {result['model_version']}",
        correlation_id=correlation_id,
        severity="MEDIUM",
        actor_id=auth.identity.id,
        details={"metrics": result["metrics"], "rows": rows, "seed": seed},
        is_simulated=False,
    )
    db.commit()
    return _evaluation_payload()
