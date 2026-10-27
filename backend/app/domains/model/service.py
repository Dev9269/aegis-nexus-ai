from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from app.audit.service import append_audit
from app.core.errors import ApiError
from app.db.models import Identity, new_id
from app.domains.events.service import record_event
from app.domains.model.schemas import (
    ConfusionMatrix,
    ModelEvaluationOut,
    ModelMetricSet,
)
from app.ml.runtime import (
    feature_metadata,
    get_evaluation,
    get_metadata,
    model_available,
    retrain,
)


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


def model_evaluation(db: Session, *, actor: Identity) -> ModelEvaluationOut:
    return _evaluation_payload()


def model_features() -> list[dict]:
    return feature_metadata()


def retrain_model(
    db: Session, *, seed: int, rows: int, actor: Identity
) -> ModelEvaluationOut:
    result = retrain(seed=seed, rows=rows)
    correlation_id = new_id()
    append_audit(
        db,
        actor=actor,
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
        actor_id=actor.id,
        details={"metrics": result["metrics"], "rows": rows, "seed": seed},
        is_simulated=False,
    )
    db.commit()
    return _evaluation_payload()
