from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.ml.features import FEATURE_NAMES, validate_features
from app.ml.runtime import load_bundle, predict
from ml.evaluation.evaluate import evaluate_predictions
from ml.training.generate_data import generate_training_data
from ml.training.train import train_model


@pytest.fixture(scope="session")
def trained_artifact(tmp_path_factory):
    path = tmp_path_factory.mktemp("aegis-ml-artifact")
    result = train_model(artifact_dir=path, seed=42, rows=4000)
    return path, result


def test_training_data_has_required_features_without_missing_values():
    frame = generate_training_data(seed=7, rows=1200)
    assert list(frame.columns[:-1]) == FEATURE_NAMES
    assert frame[FEATURE_NAMES].isna().sum().sum() == 0
    assert set(frame["is_injected_anomaly"].unique()) == {0, 1}
    assert frame["is_injected_anomaly"].mean() < 0.25


def test_feature_validation_rejects_missing_and_out_of_range_values():
    valid = {
        "login_hour": 10,
        "day_of_week": 2,
        "failed_logins_15m": 0,
        "requests_1h": 12,
        "distinct_resources_1h": 3,
        "sensitive_access_ratio": 0.1,
        "new_device": False,
        "geo_novelty": False,
        "session_duration_min": 45,
        "activity_deviation": 0.2,
    }
    assert list(validate_features(valid)) == FEATURE_NAMES
    with pytest.raises(ValueError):
        validate_features({**valid, "failed_logins_15m": 999})
    broken = dict(valid)
    broken.pop("new_device")
    with pytest.raises(ValueError):
        validate_features(broken)
    with pytest.raises(ValueError):
        validate_features({**valid, "new_device": "yes"})


def test_training_writes_artifacts_and_held_out_evaluation(trained_artifact):
    path, result = trained_artifact
    assert (path / "model.joblib").exists()
    assert (path / "metadata.json").exists()
    assert (path / "evaluation.json").exists()
    evaluation = json.loads((path / "evaluation.json").read_text(encoding="utf-8"))
    assert evaluation["train_rows"] + evaluation["test_rows"] == result["rows"]
    assert 0 <= evaluation["metrics"]["precision"] <= 1
    assert 0 <= evaluation["metrics"]["recall"] <= 1
    assert 0 <= evaluation["metrics"]["false_positive_rate"] <= 1
    matrix = evaluation["confusion_matrix"]
    assert (
        matrix["true_negative"]
        + matrix["false_positive"]
        + matrix["false_negative"]
        + matrix["true_positive"]
        == evaluation["test_rows"]
    )
    assert "not an attack likelihood" in evaluation["score_interpretation"].lower()
    assert "calibrated probability" in evaluation["score_interpretation"].lower()


def test_training_is_deterministic_for_same_seed(tmp_path):
    first = train_model(artifact_dir=tmp_path / "a", seed=99, rows=2500)
    second = train_model(artifact_dir=tmp_path / "b", seed=99, rows=2500)
    assert first["metrics"] == second["metrics"]
    assert first["evaluation"]["confusion_matrix"] == second["evaluation"]["confusion_matrix"]


def test_predictions_are_explainable_and_risk_normalized(trained_artifact):
    path, _ = trained_artifact
    prediction = predict(
        {
            "login_hour": 3,
            "day_of_week": 6,
            "failed_logins_15m": 14,
            "requests_1h": 180,
            "distinct_resources_1h": 20,
            "sensitive_access_ratio": 0.92,
            "new_device": True,
            "geo_novelty": True,
            "session_duration_min": 6,
            "activity_deviation": 4.2,
        },
        artifact_dir=path,
    )
    assert 0 <= prediction["risk_score"] <= 100
    assert prediction["risk_category"] in {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
    assert prediction["feature_summary"]
    assert prediction["model_version"]
    assert prediction["limitations"]
    assert "probability" in prediction["score_interpretation"].lower()


def test_anomalies_rank_higher_than_normal_events(trained_artifact):
    path, _ = trained_artifact
    normal = predict(
        {
            "login_hour": 10,
            "day_of_week": 2,
            "failed_logins_15m": 0,
            "requests_1h": 12,
            "distinct_resources_1h": 3,
            "sensitive_access_ratio": 0.08,
            "new_device": False,
            "geo_novelty": False,
            "session_duration_min": 55,
            "activity_deviation": 0.1,
        },
        artifact_dir=path,
    )
    anomaly = predict(
        {
            "login_hour": 2,
            "day_of_week": 6,
            "failed_logins_15m": 16,
            "requests_1h": 220,
            "distinct_resources_1h": 28,
            "sensitive_access_ratio": 0.95,
            "new_device": True,
            "geo_novelty": True,
            "session_duration_min": 5,
            "activity_deviation": 5.4,
        },
        artifact_dir=path,
    )
    assert anomaly["risk_score"] > normal["risk_score"]
    assert anomaly["risk_score"] >= 55


def test_saved_model_loads(trained_artifact):
    path, result = trained_artifact
    bundle = load_bundle(path)
    assert bundle["metadata"]["model_version"] == result["model_version"]
    assert bundle["metadata"]["feature_names"] == FEATURE_NAMES


def test_evaluation_metrics_are_mathematically_consistent():
    metrics = evaluate_predictions(
        y_true=[0, 0, 1, 1],
        risk_scores=[10, 20, 80, 90],
        threshold=55,
    )
    assert metrics["confusion_matrix"]["true_negative"] == 2
    assert metrics["confusion_matrix"]["true_positive"] == 2
    assert metrics["precision"] == 1.0
    assert metrics["recall"] == 1.0
    assert metrics["false_positive_rate"] == 0.0
