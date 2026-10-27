from __future__ import annotations

from sqlalchemy.orm import Session

from app.audit.service import append_audit
from app.core.errors import ApiError
from app.db.models import AccessPolicy, Identity, Resource, new_id
from app.domains.events.service import record_event
from app.domains.policies import repository
from app.domains.policies.engine import evaluate_policy
from app.domains.policies.schemas import (
    PolicyOut,
    PolicyPreviewIn,
    PolicyPreviewOut,
    PolicyPreviewResult,
    PolicyUpdateIn,
    ResourcePolicyOut,
)


def _resource_out(db: Session, resource: Resource) -> ResourcePolicyOut:
    policy = repository.active_policy(db, resource.id)
    version_count = repository.policy_version_count(db, resource.id)
    return ResourcePolicyOut(
        id=resource.id,
        key=resource.key,
        name=resource.name,
        description=resource.description,
        sensitivity=resource.sensitivity,
        owner_department=resource.owner_department,
        is_active=resource.is_active,
        is_simulated=resource.is_simulated,
        policy=PolicyOut.model_validate(policy) if policy else None,
        version_count=version_count,
    )


def list_resources(
    db: Session, *, q: str | None, sensitivity: str | None
) -> list[ResourcePolicyOut]:
    resources = repository.list_resource_rows(db, q=q, sensitivity=sensitivity)
    return [_resource_out(db, resource) for resource in resources]


def get_resource(db: Session, resource_id: str) -> ResourcePolicyOut:
    resource = repository.get_resource_row(db, resource_id)
    if resource is None:
        raise ApiError(404, "RESOURCE_NOT_FOUND", "Resource not found.")
    return _resource_out(db, resource)


def get_policy_history(db: Session, resource_id: str) -> list[PolicyOut]:
    if repository.get_resource_row(db, resource_id) is None:
        raise ApiError(404, "RESOURCE_NOT_FOUND", "Resource not found.")
    return [
        PolicyOut.model_validate(policy)
        for policy in repository.list_policy_rows(db, resource_id)
    ]


def update_policy(
    db: Session, *, resource_id: str, payload: PolicyUpdateIn, actor: Identity
) -> PolicyOut:
    resource = repository.get_resource_row(db, resource_id)
    if resource is None:
        raise ApiError(404, "RESOURCE_NOT_FOUND", "Resource not found.")
    if not payload.is_active:
        raise ApiError(
            422,
            "POLICY_MUST_BE_ACTIVE",
            "Policy updates must publish an active policy version.",
        )

    current = repository.active_policy(db, resource_id)
    next_version = 1
    if current is not None:
        current.is_active = False
        next_version = current.version + 1

    policy = AccessPolicy(
        resource_id=resource.id,
        version=next_version,
        allowed_roles=payload.allowed_roles,
        allowed_device_states=payload.allowed_device_states,
        challenge_threshold=payload.challenge_threshold,
        deny_threshold=payload.deny_threshold,
        require_additional_verification=payload.require_additional_verification,
        session_max_minutes=payload.session_max_minutes,
        is_active=True,
        created_by=actor.id,
        change_reason=payload.reason,
        is_simulated=resource.is_simulated,
    )
    db.add(policy)
    db.flush()

    policy_version = f"{resource.key}:v{policy.version}"
    correlation_id = new_id()
    append_audit(
        db,
        actor=actor,
        action="POLICY_VERSION_CREATED",
        target_type="access_policy",
        target_id=policy.id,
        correlation_id=correlation_id,
        result="SUCCESS",
        policy_version=policy_version,
        metadata={
            "resource_id": resource.id,
            "previous_policy_id": current.id if current else None,
            "allowed_roles": policy.allowed_roles,
            "allowed_device_states": policy.allowed_device_states,
            "challenge_threshold": policy.challenge_threshold,
            "deny_threshold": policy.deny_threshold,
            "change_reason": payload.reason,
        },
    )
    record_event(
        db,
        event_type="POLICY_UPDATED",
        category="Policy",
        summary=f"Policy {policy_version} published for {resource.name}",
        correlation_id=correlation_id,
        severity="MEDIUM",
        actor_id=actor.id,
        policy_version=policy_version,
        details={
            "resource_id": resource.id,
            "allowed_roles": policy.allowed_roles,
            "challenge_threshold": policy.challenge_threshold,
            "deny_threshold": policy.deny_threshold,
            "reason": payload.reason,
        },
        is_simulated=resource.is_simulated,
    )
    db.commit()
    db.refresh(policy)
    return PolicyOut.model_validate(policy)


def preview_policy(payload: PolicyPreviewIn) -> PolicyPreviewOut:
    results: list[PolicyPreviewResult] = []
    for index, case in enumerate(payload.cases):
        allowed_roles = payload.draft.allowed_roles if case.identity_authorized else []
        decision = evaluate_policy(
            identity_active=case.account_active,
            authenticated=case.session_active,
            session_active=case.session_active,
            session_age_minutes=0,
            role=case.role,
            resource_active=True,
            resource_sensitivity="HIGH",
            allowed_roles=list(allowed_roles),
            allowed_device_states=list(payload.draft.allowed_device_states),
            device_state=case.device_state,
            challenge_threshold=payload.draft.challenge_threshold,
            deny_threshold=payload.draft.deny_threshold,
            require_additional_verification=payload.draft.require_additional_verification,
            session_max_minutes=payload.draft.session_max_minutes,
            risk_score=case.risk_score,
            risk_category=(
                "CRITICAL"
                if case.risk_score >= 90
                else "HIGH"
                if case.risk_score >= 70
                else "MEDIUM"
                if case.risk_score >= 40
                else "LOW"
            ),
            repeated_anomalies=case.repeated_anomalies,
            requested_action="READ",
            policy_version="draft-preview",
            device_owner_mismatch=False,
        )
        results.append(
            PolicyPreviewResult(
                case_index=index,
                decision=decision.decision,
                reasons=decision.reasons,
            )
        )
    return PolicyPreviewOut(
        policy_version_preview="Draft preview only — no policy is persisted.",
        results=results,
    )
