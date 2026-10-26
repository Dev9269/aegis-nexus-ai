from __future__ import annotations

import numpy as np
import pandas as pd

from app.ml.features import FEATURE_NAMES


def _normal_activity(rng: np.random.Generator, count: int) -> dict[str, np.ndarray]:
    failed = np.clip(rng.poisson(0.25, count), 0, 4)
    requests = np.clip(rng.lognormal(mean=2.7, sigma=0.55, size=count), 2, 55)
    login_hour = np.clip(rng.normal(12.5, 2.6, count), 6, 20)
    day = rng.choice([0, 1, 2, 3, 4, 5], size=count, p=[0.22, 0.22, 0.22, 0.2, 0.1, 0.04])
    return {
        "login_hour": np.rint(login_hour).astype(int),
        "day_of_week": day.astype(int),
        "failed_logins_15m": failed.astype(int),
        "requests_1h": np.rint(requests).astype(int),
        "distinct_resources_1h": np.clip(rng.poisson(3.1, count) + 1, 1, 10).astype(int),
        "sensitive_access_ratio": np.clip(rng.beta(1.4, 5.2, count), 0, 0.6),
        "new_device": (rng.random(count) < 0.025).astype(int),
        "geo_novelty": (rng.random(count) < 0.012).astype(int),
        "session_duration_min": np.clip(rng.lognormal(4.0, 0.55, count), 4, 300),
        "activity_deviation": np.clip(rng.gamma(1.8, 0.22, count), 0, 1.2),
    }


def generate_training_data(seed: int = 42, rows: int = 5000) -> pd.DataFrame:
    if rows < 200:
        raise ValueError("rows must be at least 200")
    rng = np.random.default_rng(seed)
    anomaly_count = max(30, int(rows * 0.12))
    normal_count = rows - anomaly_count

    normal = _normal_activity(rng, normal_count)
    anomaly: dict[str, np.ndarray] = {}
    kinds = rng.integers(0, 5, anomaly_count)
    credentials = kinds == 0
    lateral = kinds == 1
    impossible = kinds == 2
    off_hours = kinds == 3
    exfil = kinds == 4

    anomaly["login_hour"] = np.where(
        off_hours, rng.integers(0, 6, anomaly_count), rng.integers(0, 24, anomaly_count)
    )
    anomaly["day_of_week"] = rng.integers(0, 7, anomaly_count)
    anomaly["failed_logins_15m"] = np.where(
        credentials,
        rng.integers(5, 31, anomaly_count),
        rng.integers(0, 4, anomaly_count),
    )
    anomaly["requests_1h"] = np.where(
        lateral | credentials | exfil,
        rng.integers(80, 401, anomaly_count),
        rng.integers(15, 90, anomaly_count),
    )
    anomaly["distinct_resources_1h"] = np.where(
        lateral,
        rng.integers(16, 51, anomaly_count),
        rng.integers(6, 20, anomaly_count),
    )
    anomaly["sensitive_access_ratio"] = np.where(
        exfil | lateral,
        rng.uniform(0.65, 1.0, anomaly_count),
        rng.uniform(0.2, 0.75, anomaly_count),
    )
    anomaly["new_device"] = np.where(
        impossible | credentials,
        1,
        (rng.random(anomaly_count) < 0.35).astype(int),
    )
    anomaly["geo_novelty"] = np.where(
        impossible,
        1,
        (rng.random(anomaly_count) < 0.25).astype(int),
    )
    anomaly["session_duration_min"] = np.where(
        exfil,
        rng.uniform(180, 720, anomaly_count),
        rng.uniform(1, 25, anomaly_count),
    )
    anomaly["activity_deviation"] = np.where(
        lateral | exfil,
        rng.uniform(2.4, 7.0, anomaly_count),
        rng.uniform(1.5, 4.5, anomaly_count),
    )

    normal_rows = pd.DataFrame(normal)
    anomaly_rows = pd.DataFrame(anomaly)
    normal_rows["is_injected_anomaly"] = 0
    anomaly_rows["is_injected_anomaly"] = 1
    frame = pd.concat([normal_rows, anomaly_rows], ignore_index=True)
    frame = frame.sample(frac=1.0, random_state=seed).reset_index(drop=True)
    frame = frame[FEATURE_NAMES + ["is_injected_anomaly"]]
    validate_training_data(frame)
    return frame


def validate_training_data(frame: pd.DataFrame) -> None:
    missing_columns = set(FEATURE_NAMES + ["is_injected_anomaly"]) - set(frame.columns)
    if missing_columns:
        raise ValueError(f"training data missing columns: {sorted(missing_columns)}")
    if frame[FEATURE_NAMES].isna().any().any():
        raise ValueError("training data contains missing feature values")
    if not set(frame["is_injected_anomaly"].unique()).issubset({0, 1}):
        raise ValueError("training labels must be binary")
    if frame["login_hour"].min() < 0 or frame["login_hour"].max() > 23:
        raise ValueError("login_hour outside valid range")
    if frame["day_of_week"].min() < 0 or frame["day_of_week"].max() > 6:
        raise ValueError("day_of_week outside valid range")
    if frame["sensitive_access_ratio"].min() < 0 or frame["sensitive_access_ratio"].max() > 1:
        raise ValueError("sensitive_access_ratio outside valid range")
    if frame["failed_logins_15m"].min() < 0 or frame["requests_1h"].min() < 0:
        raise ValueError("count features cannot be negative")
