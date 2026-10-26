from __future__ import annotations

from typing import Any

FEATURE_NAMES = [
    "login_hour",
    "day_of_week",
    "failed_logins_15m",
    "requests_1h",
    "distinct_resources_1h",
    "sensitive_access_ratio",
    "new_device",
    "geo_novelty",
    "session_duration_min",
    "activity_deviation",
]

FEATURE_INFO: dict[str, dict[str, Any]] = {
    "login_hour": {
        "label": "Login hour",
        "unit": "hour of day (0-23, UTC)",
        "type": "integer",
        "min": 0,
        "max": 23,
        "description": "Hour of the authentication event in UTC.",
    },
    "day_of_week": {
        "label": "Day of week",
        "unit": "0=Monday, 6=Sunday",
        "type": "integer",
        "min": 0,
        "max": 6,
        "description": "Calendar day of the event in UTC.",
    },
    "failed_logins_15m": {
        "label": "Failed logins (15m)",
        "unit": "count",
        "type": "integer",
        "min": 0,
        "max": 100,
        "description": "Failed authentication attempts in the trailing 15 minutes.",
    },
    "requests_1h": {
        "label": "Requests (1h)",
        "unit": "count",
        "type": "integer",
        "min": 0,
        "max": 1000,
        "description": "Access requests made in the trailing 60 minutes.",
    },
    "distinct_resources_1h": {
        "label": "Distinct resources (1h)",
        "unit": "count",
        "type": "integer",
        "min": 0,
        "max": 100,
        "description": "Unique resources requested in the trailing 60 minutes.",
    },
    "sensitive_access_ratio": {
        "label": "Sensitive access ratio",
        "unit": "ratio 0-1",
        "type": "number",
        "min": 0,
        "max": 1,
        "description": "Share of recent requests to high or critical sensitivity resources.",
    },
    "new_device": {
        "label": "New device",
        "unit": "boolean",
        "type": "boolean",
        "min": 0,
        "max": 1,
        "description": "Whether the device was first observed for this identity in the last 7 days.",
    },
    "geo_novelty": {
        "label": "Geographic novelty",
        "unit": "boolean",
        "type": "boolean",
        "min": 0,
        "max": 1,
        "description": "Whether trusted location context marks the source as novel. Prototype context is simulated.",
    },
    "session_duration_min": {
        "label": "Session duration",
        "unit": "minutes",
        "type": "number",
        "min": 0,
        "max": 1440,
        "description": "Elapsed time since session authentication.",
    },
    "activity_deviation": {
        "label": "Activity deviation",
        "unit": "relative deviation",
        "type": "number",
        "min": 0,
        "max": 10,
        "description": "Declared deviation from the identity's established activity baseline.",
    },
}


def validate_features(payload: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError("features must be an object")
    missing = [name for name in FEATURE_NAMES if name not in payload]
    if missing:
        raise ValueError(f"missing required features: {', '.join(missing)}")
    validated: dict[str, Any] = {}
    for name in FEATURE_NAMES:
        info = FEATURE_INFO[name]
        value = payload[name]
        if info["type"] == "boolean":
            if not isinstance(value, bool):
                raise ValueError(f"{name} must be a boolean")
            validated[name] = value
            continue
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError(f"{name} must be numeric")
        number = float(value)
        if not (info["min"] <= number <= info["max"]):
            raise ValueError(f"{name} must be between {info['min']} and {info['max']}")
        validated[name] = int(number) if info["type"] == "integer" else number
    return validated


def feature_vector(payload: dict[str, Any]) -> list[float]:
    validated = validate_features(payload)
    return [float(validated[name]) for name in FEATURE_NAMES]
