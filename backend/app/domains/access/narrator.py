from __future__ import annotations

from typing import Any


def narrate_decision(
    *,
    subject_name: str,
    subject_role: str,
    resource_name: str,
    resource_sensitivity: str,
    requested_action: str,
    decision: str,
    risk_score: float,
    risk_category: str,
    reasons: list[dict[str, Any]],
    policy_version: str,
    repeated_anomalies: int = 0,
    device_state: str | None = None,
    device_owner_mismatch: bool = False,
) -> str:
    reason_codes = [r.get("code", "") for r in reasons]
    bullets: list[str] = []

    if decision == "ALLOW":
        headline = f"Access ALLOWED for {subject_name} ({subject_role}) to {requested_action} {resource_name}."
    elif decision == "DENY":
        headline = f"Access DENIED for {subject_name} ({subject_role}) to {requested_action} {resource_name}."
    elif decision == "CHALLENGE":
        headline = f"Access CHALLENGED - step-up verification required for {subject_name} to {requested_action} {resource_name}."
    elif decision == "RESTRICT":
        headline = f"Access RESTRICTED - sessions revoked for {subject_name} attempting {requested_action} on {resource_name}."
    else:
        headline = f"Decision {decision} for {subject_name} on {resource_name}."

    if "AUTHENTICATION_MISSING" in reason_codes or "SESSION_EXPIRED" in reason_codes:
        bullets.append("The user session is missing or expired - re-authentication is required.")
    if "IDENTITY_DISABLED" in reason_codes:
        bullets.append("The subject identity is disabled or inactive.")
    if "ROLE_NOT_ALLOWED" in reason_codes:
        bullets.append(f"The role '{subject_role}' is not permitted to access this resource.")
    if "DEVICE_REVOKED" in reason_codes or "DEVICE_STATE_DENIED" in reason_codes:
        bullets.append(f"Device state '{device_state}' is not allowed by policy.")
    if "DEVICE_OWNER_MISMATCH" in reason_codes or device_owner_mismatch:
        bullets.append("The device is registered to a different identity (possible device sharing).")
    if "RESOURCE_INACTIVE" in reason_codes:
        bullets.append(f"Resource '{resource_name}' is currently inactive.")
    if "ACTION_NOT_ALLOWED" in reason_codes:
        bullets.append(f"The action '{requested_action}' is not permitted on this resource.")
    if "SESSION_TOO_OLD" in reason_codes:
        bullets.append("The session has exceeded the maximum allowed age - re-authentication needed.")
    if "ADDITIONAL_VERIFICATION_REQUIRED" in reason_codes:
        bullets.append("Policy requires additional verification (MFA/step-up) before access.")

    if risk_category in {"HIGH", "CRITICAL"}:
        bullets.append(
            f"Behavioral anomaly score is {risk_score:.1f}/100 ({risk_category}) - "
            "unusual patterns detected in login time, request volume, or resource access."
        )
    elif risk_category == "MEDIUM":
        bullets.append(
            f"Moderate behavioral risk detected ({risk_score:.1f}/100) - "
            "some deviations from baseline behavior observed."
        )
    else:
        bullets.append(f"Behavioral risk is low ({risk_score:.1f}/100) - activity matches established baseline.")

    if repeated_anomalies > 0:
        bullets.append(
            f"{repeated_anomalies} prior high-risk events detected in the last 15 minutes - "
            "possible coordinated or sustained attack."
        )

    if resource_sensitivity in {"HIGH", "CRITICAL"}:
        bullets.append(f"Resource sensitivity is {resource_sensitivity} - elevated scrutiny applied.")

    bullets.append("Zero-trust principle: policy denial is final; the anomaly model may only escalate risk, never override a deny.")

    return headline + " " + " ".join(bullets)


def confidence_score(
    *,
    decision: str,
    risk_score: float,
    reasons: list[dict[str, Any]],
    repeated_anomalies: int = 0,
) -> float:
    base = 0.85
    if decision in {"DENY", "RESTRICT"}:
        base = 0.95
    if repeated_anomalies > 0:
        base = min(1.0, base + 0.05)
    if len(reasons) > 3:
        base = min(1.0, base + 0.05)
    if risk_score < 30 and decision == "ALLOW":
        base = min(1.0, base + 0.05)
    return round(base, 2)
