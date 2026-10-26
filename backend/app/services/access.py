from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.audit.service import append_audit
from app.core.time import as_utc
from app.models import (
    AccessPolicy,
    AccessRequest,
    BehavioralEvent,
    Device,
    Identity,
    Incident,
    Resource,
    Severity,
    UserSession,
    new_id,
    utcnow,
)
from app.policies.engine import PolicyDecision, evaluate_policy
from app.security.sessions import revoke_identity_sessions
from app.services.anomaly import (
    REPEATED_ANOMALY_RISK_THRESHOLD,
    REPEATED_ANOMALY_WINDOW_MINUTES,
    analyze_behavior,
)
from app.services.events import record_event
from app.services.incidents import create_or_escalate_for_decision

SEVERITY_BY_RISK = {
    "LOW": Severity.LOW.value,
    "MEDIUM": Severity.MEDIUM.value,
    "HIGH": Severity.HIGH.value,
    "CRITICAL": Severity.CRITICAL.value,
}


@dataclass
class EvaluationOutcome:
    access_request: AccessRequest
    decision: PolicyDecision
    repeated_anomalies: int
    incident: Incident | None = None


def _latest_session(db: Session, identity_id: str, now) -> UserSession | None:
    return db.scalar(
        select(UserSession)
        .where(
            UserSession.identity_id == identity_id,
            UserSession.revoked_at.is_(None),
        )
        .order_by(UserSession.created_at.desc())
        .limit(1)
    )


def _repeated_anomaly_count(db: Session, identity_id: str) -> int:
    since = utcnow() - timedelta(minutes=REPEATED_ANOMALY_WINDOW_MINUTES)
    return int(
        db.scalar(
            select(func.count(BehavioralEvent.id)).where(
                BehavioralEvent.identity_id == identity_id,
                BehavioralEvent.detected_at >= since,
                BehavioralEvent.risk_score >= REPEATED_ANOMALY_RISK_THRESHOLD,
            )
        )
        or 0
    )


def _unconfigured_policy_decision() -> PolicyDecision:
    return PolicyDecision(
        decision="DENY",
        reasons=[
            {
                "code": "NO_ACTIVE_POLICY",
                "message": "No active access policy is configured for this resource; access is denied by default.",
                "category": "POLICY",
                "severity": "CRITICAL",
            }
        ],
        recommended_action="Deny the request until an authorized policy is published for the resource.",
    )


def evaluate_access(
    db: Session,
    *,
    subject: Identity,
    resource: Resource,
    device: Device | None,
    requested_action: str,
    features: dict[str, Any],
    actor: Identity,
    simulate: bool,
) -> EvaluationOutcome:
    now = utcnow()
    is_simulated = bool(simulate or subject.is_simulated)
    correlation_id = new_id()
    behavioral_event = analyze_behavior(
        db,
        identity=subject,
        device_id=device.id if device else None,
        features=features,
        is_simulated=is_simulated,
    )

    policy = db.scalar(
        select(AccessPolicy)
        .where(
            AccessPolicy.resource_id == resource.id,
            AccessPolicy.is_active.is_(True),
        )
        .order_by(AccessPolicy.version.desc())
        .limit(1)
    )
    policy_version = f"{resource.key}:v{policy.version}" if policy else f"{resource.key}:unconfigured"

    session = _latest_session(db, subject.id, now)
    session_active = bool(
        session
        and session.revoked_at is None
        and (as_utc(session.expires_at) or now) > now
    )
    if session and session_active:
        session_age_minutes = max(
            0.0,
            (now - (as_utc(session.created_at) or now)).total_seconds() / 60,
        )
    else:
        session_age_minutes = 0.0

    repeated_anomalies = _repeated_anomaly_count(db, subject.id)
    device_owner_mismatch = bool(device and device.identity_id != subject.id)

    if policy is None:
        decision = _unconfigured_policy_decision()
    else:
        decision = evaluate_policy(
            identity_active=subject.status == "ACTIVE",
            authenticated=session_active,
            session_active=session_active,
            session_age_minutes=session_age_minutes,
            role=subject.role,
            resource_active=resource.is_active,
            resource_sensitivity=resource.sensitivity,
            allowed_roles=list(policy.allowed_roles or []),
            allowed_device_states=list(policy.allowed_device_states or []),
            device_state=device.state if device else None,
            challenge_threshold=policy.challenge_threshold,
            deny_threshold=policy.deny_threshold,
            require_additional_verification=policy.require_additional_verification,
            session_max_minutes=policy.session_max_minutes,
            risk_score=behavioral_event.risk_score,
            risk_category=behavioral_event.risk_category,
            repeated_anomalies=repeated_anomalies,
            requested_action=requested_action,
            policy_version=policy_version,
            device_owner_mismatch=device_owner_mismatch,
        )

    access_request = AccessRequest(
        id=new_id(),
        identity_id=subject.id,
        resource_id=resource.id,
        device_id=device.id if device else None,
        behavioral_event_id=behavioral_event.id,
        requested_action=requested_action,
        decision=decision.decision,
        risk_score=behavioral_event.risk_score,
        risk_category=behavioral_event.risk_category,
        anomaly_score=behavioral_event.anomaly_score,
        policy_version=policy_version,
        reasons=decision.reasons,
        recommended_action=decision.recommended_action,
        correlation_id=correlation_id,
        created_at=now,
        is_simulated=is_simulated,
    )
    db.add(access_request)
    db.flush()

    subject.current_risk = round(
        min(100.0, max(0.0, (subject.current_risk * 0.65) + (behavioral_event.risk_score * 0.35))),
        2,
    )
    subject.last_activity_at = now

    severity = SEVERITY_BY_RISK.get(behavioral_event.risk_category, Severity.LOW.value)
    record_event(
        db,
        event_type="POLICY_EVALUATED",
        category="Access",
        summary=(
            f"{decision.decision} for {subject.display_name} → {resource.name} "
            f"(risk {behavioral_event.risk_score:.1f})"
        ),
        correlation_id=correlation_id,
        severity=Severity.LOW.value if decision.decision == "ALLOW" else severity,
        identity_id=subject.id,
        device_id=device.id if device else None,
        access_request_id=access_request.id,
        actor_id=actor.id,
        policy_version=policy_version,
        details={
            "decision": decision.decision,
            "risk_score": behavioral_event.risk_score,
            "risk_category": behavioral_event.risk_category,
            "reason_codes": [reason["code"] for reason in decision.reasons],
            "requested_action": requested_action,
            "repeated_anomalies": repeated_anomalies,
        },
        is_simulated=is_simulated,
    )

    if behavioral_event.risk_score >= 55:
        record_event(
            db,
            event_type="ANOMALY_DETECTED",
            category="Anomaly",
            summary=(
                f"{behavioral_event.risk_category.title()} behavioral risk detected for "
                f"{subject.display_name}"
            ),
            correlation_id=correlation_id,
            severity=severity,
            identity_id=subject.id,
            device_id=device.id if device else None,
            access_request_id=access_request.id,
            actor_id=actor.id,
            policy_version=policy_version,
            details={
                "risk_score": behavioral_event.risk_score,
                "risk_category": behavioral_event.risk_category,
                "top_factors": behavioral_event.feature_summary,
            },
            is_simulated=is_simulated,
        )

    if decision.decision == "DENY":
        record_event(
            db,
            event_type="ACCESS_DENIED",
            category="Access",
            summary=f"Access denied: {subject.display_name} → {resource.name}",
            correlation_id=correlation_id,
            severity=Severity.HIGH.value,
            identity_id=subject.id,
            device_id=device.id if device else None,
            access_request_id=access_request.id,
            actor_id=actor.id,
            policy_version=policy_version,
            details={"reason_codes": [reason["code"] for reason in decision.reasons]},
            is_simulated=is_simulated,
        )
    elif decision.decision == "CHALLENGE":
        record_event(
            db,
            event_type="STEP_UP_REQUIRED",
            category="Access",
            summary=f"Step-up verification required for {subject.display_name} → {resource.name}",
            correlation_id=correlation_id,
            severity=Severity.MEDIUM.value,
            identity_id=subject.id,
            device_id=device.id if device else None,
            access_request_id=access_request.id,
            actor_id=actor.id,
            policy_version=policy_version,
            details={"reason_codes": [reason["code"] for reason in decision.reasons]},
            is_simulated=is_simulated,
        )
    elif decision.decision == "RESTRICT":
        revoked = revoke_identity_sessions(db, subject.id)
        record_event(
            db,
            event_type="SESSION_RESTRICTED",
            category="Access",
            summary=f"Session restricted and {revoked} active session(s) revoked for {subject.display_name}",
            correlation_id=correlation_id,
            severity=Severity.HIGH.value,
            identity_id=subject.id,
            device_id=device.id if device else None,
            access_request_id=access_request.id,
            actor_id=actor.id,
            policy_version=policy_version,
            details={
                "reason_codes": [reason["code"] for reason in decision.reasons],
                "revoked_sessions": revoked,
            },
            is_simulated=is_simulated,
        )
        append_audit(
            db,
            actor=actor,
            action="SESSION_REVOKED",
            target_type="identity",
            target_id=subject.id,
            correlation_id=correlation_id,
            result="SUCCESS",
            policy_version=policy_version,
            metadata={"access_request_id": access_request.id, "revoked_sessions": revoked},
        )
    else:
        record_event(
            db,
            event_type="ACCESS_GRANTED",
            category="Access",
            summary=f"Access granted: {subject.display_name} → {resource.name}",
            correlation_id=correlation_id,
            severity=Severity.LOW.value,
            identity_id=subject.id,
            device_id=device.id if device else None,
            access_request_id=access_request.id,
            actor_id=actor.id,
            policy_version=policy_version,
            details={"reason_codes": [reason["code"] for reason in decision.reasons]},
            is_simulated=is_simulated,
        )

    incident = create_or_escalate_for_decision(
        db,
        identity=subject,
        access_request=access_request,
        is_simulated=is_simulated,
    )

    append_audit(
        db,
        actor=actor,
        action="ACCESS_DECISION",
        target_type="access_request",
        target_id=access_request.id,
        correlation_id=correlation_id,
        result=decision.decision,
        policy_version=policy_version,
        metadata={
            "identity_id": subject.id,
            "resource_id": resource.id,
            "device_id": device.id if device else None,
            "risk_score": behavioral_event.risk_score,
            "risk_category": behavioral_event.risk_category,
            "reason_codes": [reason["code"] for reason in decision.reasons],
            "requested_action": requested_action,
            "simulated": is_simulated,
        },
    )
    db.flush()
    return EvaluationOutcome(
        access_request=access_request,
        decision=decision,
        repeated_anomalies=repeated_anomalies,
        incident=incident,
    )
