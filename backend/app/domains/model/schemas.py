from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


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
