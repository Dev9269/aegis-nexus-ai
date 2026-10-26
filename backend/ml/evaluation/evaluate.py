from __future__ import annotations

from typing import Any

import numpy as np
from sklearn.metrics import confusion_matrix, f1_score, precision_score, recall_score, roc_auc_score


def evaluate_predictions(
    y_true: list[int] | np.ndarray,
    risk_scores: list[float] | np.ndarray,
    threshold: float = 55.0,
) -> dict[str, Any]:
    labels = np.asarray(y_true, dtype=int)
    scores = np.asarray(risk_scores, dtype=float)
    if labels.shape != scores.shape:
        raise ValueError("y_true and risk_scores must contain the same number of rows")
    predictions = (scores >= threshold).astype(int)
    matrix = confusion_matrix(labels, predictions, labels=[0, 1])
    tn, fp, fn, tp = (int(value) for value in matrix.ravel())
    denominator = fp + tn
    roc_auc = None
    if len(set(labels.tolist())) == 2:
        roc_auc = float(roc_auc_score(labels, scores))
    return {
        "precision": float(precision_score(labels, predictions, zero_division=0)),
        "recall": float(recall_score(labels, predictions, zero_division=0)),
        "f1": float(f1_score(labels, predictions, zero_division=0)),
        "false_positive_rate": float(fp / denominator) if denominator else 0.0,
        "roc_auc": roc_auc,
        "threshold": threshold,
        "confusion_matrix": {
            "true_negative": tn,
            "false_positive": fp,
            "false_negative": fn,
            "true_positive": tp,
        },
    }
