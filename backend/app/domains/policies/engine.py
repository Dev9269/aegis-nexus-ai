from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class PolicyDecision:
    decision: str
    reasons: list[dict[str, Any]] = field(default_factory=list)
    recommended_action: str = ""


def _reason(
    code: str,
    message: str,
    *,
    category: str,
    severity: str = "INFO",
) -> dict[str, Any]:
    return {
        "code": code,
        "message": message,
        "category": category,
        "severity": severity,
    }


def _recommendation(decision: str) -> str:
    if decision == "ALLOW":
        return "Allow access and continue behavioral monitoring."
    if decision == "CHALLENGE":
        return "Require step-up authentication or additional security verification before granting access."
    if decision == "RESTRICT":
        return "Restrict the session, revoke active credentials, and escalate for analyst review."
    return "Block the request, preserve audit evidence, and review the identity and device context."


def evaluate_policy(
    *,
    identity_active: bool,
    authenticated: bool,
    session_active: bool,
    session_age_minutes: float,
    role: str,
    resource_active: bool,
    resource_sensitivity: str,
    allowed_roles: list[str],
    allowed_device_states: list[str],
    device_state: str | None,
    challenge_threshold: int,
    deny_threshold: int,
    require_additional_verification: bool,
    session_max_minutes: int,
    risk_score: float,
    risk_category: str,
    repeated_anomalies: int,
    requested_action: str,
    policy_version: str,
    device_owner_mismatch: bool = False,
) -> PolicyDecision:
    reasons: list[dict[str, Any]] = []

    if not authenticated:
        reasons.append(
            _reason(
                "AUTHENTICATION_REQUIRED",
                "The request lacks an authenticated identity session.",
                category="AUTHENTICATION",
                severity="CRITICAL",
            )
        )
    if not identity_active:
        reasons.append(
            _reason(
                "ACCOUNT_DISABLED",
                "The identity account is disabled; access is mandatory-denied.",
                category="ACCOUNT_STATUS",
                severity="CRITICAL",
            )
        )
    if not resource_active:
        reasons.append(
            _reason(
                "RESOURCE_INACTIVE",
                "The requested resource is inactive.",
                category="AUTHORIZATION",
                severity="CRITICAL",
            )
        )
    if role not in allowed_roles:
        reasons.append(
            _reason(
                "ROLE_NOT_AUTHORIZED",
                f"Role {role} is not authorized for this resource by policy {policy_version}.",
                category="AUTHORIZATION",
                severity="CRITICAL",
            )
        )
    if requested_action == "ADMIN" and role != "SECURITY_ADMIN":
        reasons.append(
            _reason(
                "ACTION_NOT_AUTHORIZED",
                "Administrative actions require the Security Administrator role.",
                category="AUTHORIZATION",
                severity="CRITICAL",
            )
        )
    if (
        requested_action == "DELETE"
        and resource_sensitivity in {"HIGH", "CRITICAL"}
        and role != "SECURITY_ADMIN"
    ):
        reasons.append(
            _reason(
                "ACTION_NOT_AUTHORIZED",
                "Deletion on high-sensitivity resources requires the Security Administrator role.",
                category="AUTHORIZATION",
                severity="CRITICAL",
            )
        )
    if device_owner_mismatch:
        reasons.append(
            _reason(
                "DEVICE_OWNERSHIP_MISMATCH",
                "The supplied device is not enrolled to the requesting identity.",
                category="DEVICE_POLICY",
                severity="CRITICAL",
            )
        )
    if device_state is None:
        reasons.append(
            _reason(
                "DEVICE_REQUIRED",
                "A registered device is required for this access request.",
                category="DEVICE_POLICY",
                severity="CRITICAL",
            )
        )
    elif device_state == "REVOKED":
        reasons.append(
            _reason(
                "DEVICE_REVOKED",
                "The device is revoked and cannot be used to access resources.",
                category="DEVICE_POLICY",
                severity="CRITICAL",
            )
        )
    elif device_state not in allowed_device_states:
        reasons.append(
            _reason(
                "DEVICE_POLICY_VIOLATION",
                f"Device state {device_state} is outside the allowed states for policy {policy_version}.",
                category="DEVICE_POLICY",
                severity="CRITICAL",
            )
        )
    if not session_active:
        reasons.append(
            _reason(
                "SESSION_REQUIRED",
                "No active session exists for the requesting identity.",
                category="SESSION_POLICY",
                severity="CRITICAL",
            )
        )

    if reasons:
        return PolicyDecision(
            decision="DENY",
            reasons=reasons,
            recommended_action=_recommendation("DENY"),
        )

    session_challenge_required = session_age_minutes > session_max_minutes
    if session_challenge_required:
        reasons.append(
            _reason(
                "SESSION_MAX_EXCEEDED",
                f"Session age {session_age_minutes:.0f}m exceeds the {session_max_minutes}m policy limit.",
                category="SESSION_POLICY",
                severity="WARNING",
            )
        )

    if risk_score >= deny_threshold:
        reasons.append(
            _reason(
                "RISK_POLICY_DENY",
                (
                    f"Anomaly risk {risk_score:.1f} meets the deterministic policy denial threshold "
                    f"of {deny_threshold} for {policy_version}."
                ),
                category="RISK_POLICY",
                severity="CRITICAL",
            )
        )
        return PolicyDecision(
            decision="DENY",
            reasons=reasons,
            recommended_action=_recommendation("DENY"),
        )

    if repeated_anomalies >= 3:
        reasons.append(
            _reason(
                "REPEATED_ANOMALIES",
                f"{repeated_anomalies} high-risk behavioral events were recorded in the last 30 minutes.",
                category="REPEATED_ANOMALY",
                severity="CRITICAL",
            )
        )
        return PolicyDecision(
            decision="RESTRICT",
            reasons=reasons,
            recommended_action=_recommendation("RESTRICT"),
        )

    if risk_score >= challenge_threshold:
        if require_additional_verification:
            reasons.append(
                _reason(
                    "RISK_POLICY_CHALLENGE",
                    (
                        f"Anomaly risk {risk_score:.1f} meets the verification threshold of "
                        f"{challenge_threshold} for {policy_version}."
                    ),
                    category="RISK_POLICY",
                    severity="WARNING",
                )
            )
        else:
            reasons.append(
                _reason(
                    "RISK_ADVISORY_ONLY",
                    (
                        f"Anomaly risk {risk_score:.1f} exceeds the advisory threshold, but this policy "
                        "does not require additional verification."
                    ),
                    category="RISK_POLICY",
                    severity="WARNING",
                )
            )

    if reasons:
        decision = (
            "CHALLENGE"
            if session_challenge_required
            or any(reason["code"] == "RISK_POLICY_CHALLENGE" for reason in reasons)
            else "ALLOW"
        )
        return PolicyDecision(
            decision=decision,
            reasons=reasons,
            recommended_action=_recommendation(decision),
        )

    reasons.append(
        _reason(
            "ALL_POLICIES_SATISFIED",
            (
                f"Identity, role, device, session state, and risk level satisfy policy {policy_version}. "
                f"Risk category: {risk_category}."
            ),
            category="POLICY",
            severity="INFO",
        )
    )
    return PolicyDecision(
        decision="ALLOW",
        reasons=reasons,
        recommended_action=_recommendation("ALLOW"),
    )
