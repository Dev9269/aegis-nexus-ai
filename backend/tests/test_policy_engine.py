from __future__ import annotations

from app.policies.engine import evaluate_policy


def base_context(**overrides):
    context = {
        "identity_active": True,
        "authenticated": True,
        "session_active": True,
        "session_age_minutes": 5,
        "role": "EMPLOYEE",
        "resource_active": True,
        "resource_sensitivity": "HIGH",
        "allowed_roles": ["EMPLOYEE", "SECURITY_ADMIN"],
        "allowed_device_states": ["TRUSTED", "UNVERIFIED"],
        "device_state": "TRUSTED",
        "challenge_threshold": 55,
        "deny_threshold": 95,
        "require_additional_verification": True,
        "session_max_minutes": 60,
        "risk_score": 5.0,
        "risk_category": "LOW",
        "repeated_anomalies": 0,
        "requested_action": "READ",
        "policy_version": "finance-reports:v1",
    }
    context.update(overrides)
    return context


def test_low_risk_authorized_request_is_allowed():
    result = evaluate_policy(**base_context())
    assert result.decision == "ALLOW"
    assert any(reason["code"] == "ALL_POLICIES_SATISFIED" for reason in result.reasons)


def test_disabled_identity_is_denied_even_with_low_risk():
    result = evaluate_policy(**base_context(identity_active=False, risk_score=0))
    assert result.decision == "DENY"
    assert "ACCOUNT_DISABLED" in {reason["code"] for reason in result.reasons}


def test_unauthenticated_request_is_denied_even_with_low_risk():
    result = evaluate_policy(**base_context(authenticated=False, session_active=False, risk_score=0))
    assert result.decision == "DENY"
    assert "AUTHENTICATION_REQUIRED" in {reason["code"] for reason in result.reasons}


def test_unauthorized_role_is_denied_even_with_low_risk():
    result = evaluate_policy(
        **base_context(role="EMPLOYEE", allowed_roles=["SECURITY_ADMIN"], risk_score=0)
    )
    assert result.decision == "DENY"
    assert "ROLE_NOT_AUTHORIZED" in {reason["code"] for reason in result.reasons}


def test_revoked_device_is_denied_even_with_low_risk():
    result = evaluate_policy(
        **base_context(allowed_device_states=["TRUSTED", "UNVERIFIED", "REVOKED"], device_state="REVOKED", risk_score=0)
    )
    assert result.decision == "DENY"
    assert "DEVICE_REVOKED" in {reason["code"] for reason in result.reasons}


def test_device_outside_policy_is_denied():
    result = evaluate_policy(
        **base_context(allowed_device_states=["TRUSTED"], device_state="UNVERIFIED")
    )
    assert result.decision == "DENY"
    assert "DEVICE_POLICY_VIOLATION" in {reason["code"] for reason in result.reasons}


def test_missing_session_is_denied():
    result = evaluate_policy(**base_context(session_active=False))
    assert result.decision == "DENY"
    assert "SESSION_REQUIRED" in {reason["code"] for reason in result.reasons}


def test_risk_above_challenge_threshold_requires_verification():
    result = evaluate_policy(**base_context(risk_score=70, risk_category="HIGH"))
    assert result.decision == "CHALLENGE"
    codes = {reason["code"] for reason in result.reasons}
    assert "RISK_POLICY_CHALLENGE" in codes


def test_risk_above_policy_deny_threshold_is_denied():
    result = evaluate_policy(**base_context(risk_score=97, risk_category="CRITICAL"))
    assert result.decision == "DENY"
    assert "RISK_POLICY_DENY" in {reason["code"] for reason in result.reasons}


def test_repeated_anomalies_restrict_before_challenge_path():
    result = evaluate_policy(
        **base_context(risk_score=82, risk_category="CRITICAL", repeated_anomalies=3)
    )
    assert result.decision == "RESTRICT"


def test_session_max_exceeded_requires_reverification():
    result = evaluate_policy(**base_context(session_age_minutes=90))
    assert result.decision == "CHALLENGE"
    assert "SESSION_MAX_EXCEEDED" in {reason["code"] for reason in result.reasons}


def test_admin_action_requires_security_admin_role():
    result = evaluate_policy(**base_context(requested_action="ADMIN"))
    assert result.decision == "DENY"
    assert "ACTION_NOT_AUTHORIZED" in {reason["code"] for reason in result.reasons}
