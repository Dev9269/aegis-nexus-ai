from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.model_selection import train_test_split

from app.core.config import get_settings
from app.ml.features import FEATURE_INFO, FEATURE_NAMES
from app.ml.scoring import MODEL_LIMITATIONS, risk_from_score
from ml.evaluation.evaluate import evaluate_predictions
from ml.training.generate_data import generate_training_data

EVALUATION_THRESHOLD = 55.0


def _feature_baselines(frame) -> tuple[dict[str, float], dict[str, float], dict[str, float]]:
    medians: dict[str, float] = {}
    scales: dict[str, float] = {}
    prevalences: dict[str, float] = {}
    for name in FEATURE_NAMES:
        values = frame[name].astype(float)
        median = float(values.median())
        iqr = float(values.quantile(0.75) - values.quantile(0.25))
        scale = iqr / 1.349 if iqr > 1e-9 else max(float(values.std(ddof=0)), 1.0)
        medians[name] = median
        scales[name] = scale
        prevalences[name] = float((values > 0.5).mean()) if FEATURE_INFO[name]["type"] == "boolean" else float(
            values.mean()
        )
    return medians, scales, prevalences


def train_model(
    artifact_dir: str | Path | None = None,
    seed: int = 42,
    rows: int = 5000,
) -> dict[str, Any]:
    settings = get_settings()
    output = Path(artifact_dir) if artifact_dir is not None else settings.artifact_path
    output.mkdir(parents=True, exist_ok=True)

    frame = generate_training_data(seed=seed, rows=rows)
    features = frame[FEATURE_NAMES].to_numpy(dtype=float)
    labels = frame["is_injected_anomaly"].to_numpy(dtype=int)

    x_train, x_test, y_train, y_test = train_test_split(
        features,
        labels,
        test_size=0.25,
        random_state=seed,
        stratify=labels,
    )
    model = IsolationForest(
        n_estimators=250,
        max_samples=min(256, len(x_train)),
        contamination=0.08,
        random_state=seed,
        n_jobs=-1,
    )
    model.fit(x_train)

    train_scores = model.decision_function(x_train)
    test_scores = model.decision_function(x_test)
    score_center = float(np.median(train_scores))
    iqr = float(np.quantile(train_scores, 0.75) - np.quantile(train_scores, 0.25))
    score_spread = max(iqr / 1.349, float(np.std(train_scores, ddof=0)), 1e-6)
    test_risk = np.asarray(
        [risk_from_score(score, score_center, score_spread) for score in test_scores], dtype=float
    )

    medians, scales, prevalences = _feature_baselines(frame.iloc[: len(x_train)])
    trained_at = datetime.now(timezone.utc)
    model_version = f"iforest-seed{seed}-{trained_at:%Y%m%dT%H%M%SZ}"
    evaluation = evaluate_predictions(y_test, test_risk, threshold=EVALUATION_THRESHOLD)
    metrics = {
        "precision": evaluation["precision"],
        "recall": evaluation["recall"],
        "f1": evaluation["f1"],
        "false_positive_rate": evaluation["false_positive_rate"],
        "roc_auc": evaluation["roc_auc"],
        "threshold": evaluation["threshold"],
    }

    metadata: dict[str, Any] = {
        "model_version": model_version,
        "model_type": "scikit-learn IsolationForest",
        "trained_at": trained_at.isoformat(),
        "seed": seed,
        "feature_names": FEATURE_NAMES,
        "feature_info": FEATURE_INFO,
        "train_rows": int(len(x_train)),
        "test_rows": int(len(x_test)),
        "total_rows": int(len(frame)),
        "contamination": 0.08,
        "n_estimators": 250,
        "max_samples": min(256, len(x_train)),
        "score_center": score_center,
        "score_spread": score_spread,
        "feature_medians": medians,
        "feature_scales": scales,
        "feature_prevalences": prevalences,
        "risk_mapping": "sigmoid(2.2 * (robust_z - 2.2)) clipped to 0-100",
        "evaluation_threshold": EVALUATION_THRESHOLD,
        "limitations": MODEL_LIMITATIONS,
    }
    evaluation_report: dict[str, Any] = {
        "model_version": model_version,
        "evaluated_at": datetime.now(timezone.utc).isoformat(),
        "seed": seed,
        "train_rows": int(len(x_train)),
        "test_rows": int(len(x_test)),
        "label_distribution": {
            "train_normal": int((y_train == 0).sum()),
            "train_injected_anomaly": int((y_train == 1).sum()),
            "test_normal": int((y_test == 0).sum()),
            "test_injected_anomaly": int((y_test == 1).sum()),
        },
        "metrics": metrics,
        "confusion_matrix": evaluation["confusion_matrix"],
        "dataset_description": (
            "Synthetic behavioral events generated with a fixed seed. The final 25% held-out split is "
            "disjoint from training. Injected anomaly labels are used only for evaluation, never to fit the model."
        ),
        "score_interpretation": (
            "Risk index is an anomaly ranking scaled 0-100. It is not an attack likelihood and must not "
            "be treated as a calibrated probability. Policy thresholds are deterministic controls."
        ),
        "limitations": MODEL_LIMITATIONS,
    }

    bundle = {
        "model": model,
        "metadata": metadata,
        "evaluation": evaluation_report,
        "feature_medians": medians,
        "feature_scales": scales,
        "feature_prevalences": prevalences,
    }
    joblib.dump(bundle, output / "model.joblib")
    _atomic_json(output / "metadata.json", metadata)
    _atomic_json(output / "evaluation.json", evaluation_report)
    return {
        "model_version": model_version,
        "rows": int(len(frame)),
        "train_rows": int(len(x_train)),
        "test_rows": int(len(x_test)),
        "metrics": metrics,
        "evaluation": evaluation_report,
        "artifact_dir": str(output),
    }


def _atomic_json(path: Path, data: dict[str, Any]) -> None:
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(data, indent=2, sort_keys=True), encoding="utf-8")
    temporary.replace(path)
