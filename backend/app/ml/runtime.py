from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Any

import joblib

from app.core.config import get_settings
from app.ml.features import FEATURE_INFO, FEATURE_NAMES, feature_vector, validate_features
from app.ml.scoring import (
    MODEL_LIMITATIONS,
    SCORE_INTERPRETATION,
    feature_summary,
    risk_category,
    risk_from_score,
)
from app.models import utcnow

_bundle_cache: dict[str, tuple[float, dict[str, Any]]] = {}
_cache_lock = threading.Lock()
_bootstrap_lock = threading.Lock()


def artifact_path(artifact_dir: str | Path | None = None) -> Path:
    return Path(artifact_dir) if artifact_dir is not None else get_settings().artifact_path


def model_available(artifact_dir: str | Path | None = None) -> bool:
    base = artifact_path(artifact_dir)
    return (base / "model.joblib").exists() and (base / "metadata.json").exists()


def ensure_model(artifact_dir: str | Path | None = None) -> None:
    if model_available(artifact_dir):
        return
    settings = get_settings()
    if not settings.is_development:
        raise FileNotFoundError("The anomaly detection model artifact is not available.")
    with _bootstrap_lock:
        if model_available(artifact_dir):
            return
        from ml.training.train import train_model

        train_model(artifact_dir=artifact_dir, seed=42, rows=4000)
        clear_cache()


def load_bundle(artifact_dir: str | Path | None = None) -> dict[str, Any]:
    base = artifact_path(artifact_dir)
    model_path = base / "model.joblib"
    metadata_path = base / "metadata.json"
    if not model_path.exists() or not metadata_path.exists():
        raise FileNotFoundError("The anomaly detection model artifact is not available.")
    mtime = model_path.stat().st_mtime
    key = str(base.resolve())
    with _cache_lock:
        cached = _bundle_cache.get(key)
        if cached and cached[0] == mtime:
            return cached[1]
        bundle = joblib.load(model_path)
        bundle["metadata"] = json.loads(metadata_path.read_text(encoding="utf-8"))
        evaluation_path = base / "evaluation.json"
        if evaluation_path.exists():
            bundle["evaluation"] = json.loads(evaluation_path.read_text(encoding="utf-8"))
        _bundle_cache[key] = (mtime, bundle)
        return bundle


def clear_cache() -> None:
    with _cache_lock:
        _bundle_cache.clear()


def predict(features: dict[str, Any], artifact_dir: str | Path | None = None) -> dict[str, Any]:
    validated = validate_features(features)
    bundle = load_bundle(artifact_dir)
    metadata = bundle["metadata"]
    model = bundle["model"]
    vector = feature_vector(validated)
    raw_score = float(model.decision_function([vector])[0])
    risk = risk_from_score(
        raw_score,
        float(metadata["score_center"]),
        float(metadata["score_spread"]),
    )
    summary = feature_summary(
        validated,
        bundle.get("feature_medians", metadata["feature_medians"]),
        bundle.get("feature_scales", metadata["feature_scales"]),
        bundle.get("feature_prevalences", metadata.get("feature_prevalences", {})),
    )
    return {
        "anomaly_score": round(raw_score, 6),
        "risk_score": risk,
        "risk_category": risk_category(risk),
        "model_version": metadata["model_version"],
        "detection_timestamp": utcnow(),
        "feature_summary": summary,
        "limitations": MODEL_LIMITATIONS,
        "score_interpretation": SCORE_INTERPRETATION,
    }


def get_metadata(artifact_dir: str | Path | None = None) -> dict[str, Any]:
    return load_bundle(artifact_dir)["metadata"]


def get_evaluation(artifact_dir: str | Path | None = None) -> dict[str, Any]:
    bundle = load_bundle(artifact_dir)
    if "evaluation" not in bundle:
        raise FileNotFoundError("Evaluation report is not available.")
    return bundle["evaluation"]


def retrain(artifact_dir: str | Path | None = None, seed: int = 42, rows: int = 5000) -> dict[str, Any]:
    from ml.training.train import train_model

    result = train_model(artifact_dir=artifact_dir, seed=seed, rows=rows)
    clear_cache()
    return result


def feature_metadata() -> list[dict[str, Any]]:
    return [{"name": name, **FEATURE_INFO[name]} for name in FEATURE_NAMES]
