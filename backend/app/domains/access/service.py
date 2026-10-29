from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import AuthContext
from app.api.schemas import Page
from app.audit.service import append_audit
from app.core.errors import ApiError
from app.core.pagination import page_response
from app.core.roles import STAFF_ROLES, WRITE_ROLES
from app.core.time import as_utc
from app.db.models import (
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
from app.domains.access import repository
from app.domains.access.anomaly import (
    REPEATED_ANOMALY_RISK_THRESHOLD,
    REPEATED_ANOMALY_WINDOW_MINUTES,
    analyze_behavior,
)
from app.domains.access.presenters import access_detail, access_out
from app.domains.access.schemas import (
    AccessRequestDetail,
    AccessRequestOut,
    DecisionOut,
    EvaluateAccessIn,
)
from app.domains.events.service import record_event
from app.domains.incidents.service import create_or_escalate_for_decision
from app.domains.policies.engine import PolicyDecision, evaluate_policy
from app.security.sessions import revoke_identity_sessions

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


@dataclass
class CsvExport:
    headers: list[str]
    rows: list[list[Any]]
    filename: str
    correlation_id: str


def list_access_requests(
    db: Session,
    *,
    auth: AuthContext,
    filters: dict[str, Any],
    page: int,
    page_size: int,
) -> Page[AccessRequestOut]:
    rows, total = repository.list_access_rows(
        db,
        auth=auth,
        filters=filters,
        page=page,
        page_size=page_size,
    )
    return page_response(
        [access_out(row) for row in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


def get_access_request(
    db: Session, *, request_id: str, auth: AuthContext
) -> AccessRequestDetail:
    row = repository.get_access_row(db, request_id)
    if row is None:
        raise ApiError(404, "ACCESS_REQUEST_NOT_FOUND", "Access request not found.")
    is_staff = auth.identity.role in STAFF_ROLES
    if not is_staff and row.identity_id != auth.identity.id:
        raise ApiError(403, "FORBIDDEN", "You may only view your own access requests.")
    return access_detail(row)


def evaluate_access_request(
    db: Session, *, payload: EvaluateAccessIn, auth: AuthContext
) -> DecisionOut:
    if auth.identity.role == "AUDITOR":
        raise ApiError(403, "FORBIDDEN", "Auditors have read-only access.")
    is_staff = auth.identity.role in WRITE_ROLES
    subject_id = payload.identity_id or auth.identity.id
    if not is_staff and subject_id != auth.identity.id:
        raise ApiError(403, "FORBIDDEN", "You may only request access for your own identity.")
    if payload.simulate and not is_staff:
        raise ApiError(403, "FORBIDDEN", "Only security staff may run simulated access decisions.")

    subject = repository.get_identity(db, subject_id)
    if subject is None:
        raise ApiError(404, "IDENTITY_NOT_FOUND", "Identity not found.")
    resource = repository.get_resource(db, payload.resource_id)
    if resource is None:
        raise ApiError(404, "RESOURCE_NOT_FOUND", "Resource not found.")
    device = None
    if payload.device_id:
        device = repository.get_device(db, payload.device_id)
        if device is None:
            raise ApiError(404, "DEVICE_NOT_FOUND", "Device not found.")

    try:
        outcome = evaluate_access(
            db,
            subject=subject,
            resource=resource,
            device=device,
            requested_action=payload.requested_action,
            features=payload.features.model_dump(),
            actor=auth.identity,
            simulate=payload.simulate,
        )
    except FileNotFoundError as exc:
        raise ApiError(
            503,
            "MODEL_UNAVAILABLE",
            "The anomaly detection model is unavailable. Train the model before evaluating access.",
        ) from exc
    db.commit()

    request_row = outcome.access_request
    trace = [
        {"step": "authentication", "status": "ok", "detail": f"Actor {auth.identity.email} authenticated"},
        {"step": "identity", "status": "ok" if subject.status == "ACTIVE" else "deny", "detail": f"Subject {subject.email} status={subject.status}, role={subject.role}"},
        {"step": "resource", "status": "ok" if resource.is_active else "deny", "detail": f"{resource.key} ({resource.sensitivity}), active={resource.is_active}"},
        {"step": "device", "status": "ok" if device and device.identity_id == subject.id and device.state != "REVOKED" else ("warn" if not device else "deny"), "detail": device.name if device else "No device provided"},
        {"step": "policy", "status": request_row.decision, "detail": f"Policy {request_row.policy_version} evaluated"},
        {"step": "ml_anomaly", "status": request_row.risk_category.lower(), "detail": f"Risk {request_row.risk_score:.1f} / Anom {request_row.anomaly_score:.4f}"},
        {"step": "final_decision", "status": request_row.decision.lower(), "detail": f"{request_row.decision} - policy overrides AI"},
    ]
    return DecisionOut(
        request_id=request_row.id,
        identity_id=request_row.identity_id,
        resource_id=request_row.resource_id,
        requested_action=request_row.requested_action,
        decision=request_row.decision,
        risk_category=request_row.risk_category,
        risk_score=request_row.risk_score,
        anomaly_score=request_row.anomaly_score,
        policy_version=request_row.policy_version,
        reasons=request_row.reasons or [],
        recommended_next_step=request_row.recommended_action,
        timestamp=request_row.created_at,
        correlation_id=request_row.correlation_id,
        is_simulated=request_row.is_simulated,
        policy_trace=trace,
    )


def export_access_requests(
    db: Session, *, auth: AuthContext, filters: dict[str, Any]
) -> CsvExport:
    rows = repository.list_access_export_rows(db, auth=auth, filters=filters)
    csv_rows = [
        [
            row.id,
            row.created_at.isoformat() if row.created_at else "",
            row.identity.display_name if row.identity else "",
            row.identity.email if row.identity else "",
            row.resource.name if row.resource else "",
            row.resource.key if row.resource else "",
            row.requested_action,
            row.device_id or "",
            row.risk_score,
            row.risk_category,
            row.decision,
            row.policy_version,
            ",".join(reason.get("code", "") for reason in row.reasons or []),
            row.is_simulated,
        ]
        for row in rows
    ]

    correlation_id = new_id()
    append_audit(
        db,
        actor=auth.identity,
        action="EXPORT_ACCESS_REQUESTS",
        target_type="access_requests",
        target_id=None,
        correlation_id=correlation_id,
        result="SUCCESS",
        metadata={
            "row_count": len(rows),
            "filters": {
                "decision": filters.get("decision"),
                "q": bool(filters.get("q")),
            },
        },
    )
    db.commit()
    return CsvExport(
        headers=[
            "request_id",
            "timestamp",
            "identity",
            "identity_email",
            "resource",
            "resource_key",
            "action",
            "device_id",
            "risk_score",
            "risk_category",
            "decision",
            "policy_version",
            "reason_codes",
            "simulated",
        ],
        rows=csv_rows,
        filename="aegis-access-requests.csv",
        correlation_id=correlation_id,
    )


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
