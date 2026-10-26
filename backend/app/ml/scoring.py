from __future__ import annotations

import math
from typing import Any

from app.ml.features import FEATURE_INFO, FEATURE_NAMES

MODEL_LIMITATIONS = [
    "The model ranks behavioral deviation; it does not prove malicious intent or account compromise.",
    "The risk index is not a calibrated probability that an attack occurred.",
    "Training data is synthetic and device/location context is simulated, limiting real-world validity.",
    "Feature summaries are descriptive contributions to the anomaly score, not causal attribution.",
    "The model is an initial baseline and requires governed retraining and monitoring before production use.",
]

SCORE_INTERPRETATION = (
    "The risk index rescales the Isolation Forest anomaly score to 0-100 for policy evaluation. "
    "It is an anomaly ranking, not a calibrated probability that an attack occurred."
)


def risk_from_score(score: float, center: float, spread: float) -> float:
    scale = spread if spread and spread > 1e-9 else 1.0
    robust_z = (center - float(score)) / scale
    risk = 100.0 / (1.0 + math.exp(-2.2 * (robust_z - 2.2)))
    return round(max(0.0, min(100.0, risk)), 2)


def risk_category(risk_score: float) -> str:
    if risk_score < 30:
        return "LOW"
    if risk_score < 55:
        return "MEDIUM"
    if risk_score < 80:
        return "HIGH"
    return "CRITICAL"


def _message_for(name: str, value: float, baseline: float, deviation: float, direction: str) -> str:
    info = FEATURE_INFO[name]
    label = info["label"]
    if info["type"] == "boolean":
        if bool(value):
            return f"{label} was observed; baseline prevalence is {baseline:.0%}."
        return f"{label} was absent; baseline prevalence is {baseline:.0%}."
    return (
        f"{label} was {value:g} {info['unit']}, versus a baseline median of {baseline:g} "
        f"({deviation:.1f} robust deviations {direction})."
    )


def feature_summary(
    values: dict[str, Any],
    medians: dict[str, float],
    scales: dict[str, float],
    prevalences: dict[str, float],
) -> list[dict[str, Any]]:
    contributions: list[dict[str, Any]] = []
    for name in FEATURE_NAMES:
        info = FEATURE_INFO[name]
        value = float(values[name])
        baseline = medians[name]
        if info["type"] == "boolean":
            prevalence = prevalences.get(name, baseline)
            if bool(value) and prevalence < 0.25:
                deviation = 3.0 + (0.25 - prevalence) * 4
            elif not bool(value) and prevalence > 0.75:
                deviation = 3.0
            else:
                deviation = 0.0
            direction = "high" if value else "low"
        else:
            scale = scales[name] if scales[name] > 1e-9 else 1.0
            deviation = abs(value - baseline) / scale
            direction = "high" if value > baseline else "low"
        if deviation < 0.75:
            continue
        contributions.append(
            {
                "feature": name,
                "label": info["label"],
                "value": value,
                "baseline": round(baseline, 3),
                "deviation": round(deviation, 2),
                "direction": direction,
                "message": _message_for(name, value, baseline, deviation, direction),
            }
        )
    contributions.sort(key=lambda item: item["deviation"], reverse=True)
    return contributions[:4]
