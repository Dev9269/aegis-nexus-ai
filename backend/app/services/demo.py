from __future__ import annotations

from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.audit.service import append_audit
from app.core.config import get_settings
from app.core.errors import ApiError
from app.models import (
    AccessPolicy,
    AccessRequest,
    BehavioralEvent,
    Device,
    Identity,
    Incident,
    IncidentNote,
    Resource,
    SecurityEvent,
    UserSession,
    new_id,
    utcnow,
)
from app.schemas import (
    DemoResetOut,
    DemoRunOut,
    DemoScenarioInfo,
    DemoScenarioOut,
)
from app.security.sessions import active_session_count, create_session
from app.seed import seed_demo_data
from app.services.access import evaluate_access
from app.services.events import record_event

NORMAL_FEATURES: dict[str, Any] = {
    "login_hour": 10,
    "day_of_week": 2,
    "failed_logins_15m": 0,
    "requests_1h": 8,
    "distinct_resources_1h": 2,
    "sensitive_access_ratio": 0.2,
    "new_device": False,
    "geo_novelty": False,
    "session_duration_min": 45.0,
    "activity_deviation": 0.4,
}

STEP_UP_FEATURES: dict[str, Any] = {
    **NORMAL_FEATURES,
    "login_hour": 2,
    "failed_logins_15m": 3,
    "requests_1h": 24,
    "distinct_resources_1h": 5,
    "sensitive_access_ratio": 0.65,
    "new_device": True,
    "geo_novelty": True,
    "activity_deviation": 1.6,
}

REPEATED_FEATURES: dict[str, Any] = {
    **NORMAL_FEATURES,
    "login_hour": 1,
    "requests_1h": 70,
    "distinct_resources_1h": 13,
    "sensitive_access_ratio": 0.95,
    "new_device": True,
    "geo_novelty": True,
    "activity_deviation": 3.5,
}

EXFILTRATION_FEATURES: dict[str, Any] = {
    **NORMAL_FEATURES,
    "login_hour": 3,
    "failed_logins_15m": 18,
    "requests_1h": 240,
    "distinct_resources_1h": 18,
    "sensitive_access_ratio": 1.0,
    "new_device": True,
    "geo_novelty": True,
    "session_duration_min": 420.0,
    "activity_deviation": 6.5,
}

SCENARIO_DEFINITIONS: list[dict[str, Any]] = [
    {
        "scenario": "A",
        "title": "Authorized access allowed",
        "description": (
            "Maya Chen, a Finance Analyst, requests Finance Reports from her trusted laptop "
            "with low behavioral risk."
        ),
        "expected_outcome": "ALLOW with all policies satisfied.",
        "expected_decision": "ALLOW",
        "expected_reasons": ("ALL_POLICIES_SATISFIED",),
        "subject_email": "maya.chen@aegisnexus.ai",
        "subject_label": "Maya Chen",
        "resource_key": "finance-reports",
        "resource_label": "Finance Reports",
        "device_name": "Maya-MacBook-Air",
        "requested_action": "READ",
        "features": NORMAL_FEATURES,
        "attempts": 1,
        "require_incident": False,
    },
    {
        "scenario": "B",
        "title": "New device requires step-up",
        "description": (
            "Maya Chen requests Finance Reports from an unverified Windows VM with stronger "
            "behavioral deviation. The device state is permitted, but risk crosses the "
            "challenge threshold."
        ),
        "expected_outcome": "CHALLENGE with RISK_POLICY_CHALLENGE.",
        "expected_decision": "CHALLENGE",
        "expected_reasons": ("RISK_POLICY_CHALLENGE",),
        "subject_email": "maya.chen@aegisnexus.ai",
        "subject_label": "Maya Chen",
        "resource_key": "finance-reports",
        "resource_label": "Finance Reports",
        "device_name": "Unrecognized-Windows-VM",
        "requested_action": "READ",
        "features": STEP_UP_FEATURES,
        "attempts": 1,
        "require_incident": False,
    },
    {
        "scenario": "C",
        "title": "Role boundary blocks access",
        "description": (
            "Sofia Alvarez, a Sales employee, requests the Security Operations Console. "
            "Her behavior is low risk, but her role is not authorized."
        ),
        "expected_outcome": "DENY with ROLE_NOT_AUTHORIZED despite low risk.",
        "expected_decision": "DENY",
        "expected_reasons": ("ROLE_NOT_AUTHORIZED",),
        "subject_email": "sofia.alvarez@aegisnexus.ai",
        "subject_label": "Sofia Alvarez",
        "resource_key": "security-console",
        "resource_label": "Security Operations Console",
        "device_name": "Sofia-MacBook-Pro",
        "requested_action": "READ",
        "features": NORMAL_FEATURES,
        "attempts": 1,
        "require_incident": False,
    },
    {
        "scenario": "D",
        "title": "Disabled account denied",
        "description": (
            "Noah Williams, a disabled payroll specialist, attempts to open the Engineering "
            "Repository from a restricted device."
        ),
        "expected_outcome": "DENY with ACCOUNT_DISABLED.",
        "expected_decision": "DENY",
        "expected_reasons": ("ACCOUNT_DISABLED",),
        "subject_email": "noah.williams@aegisnexus.ai",
        "subject_label": "Noah Williams",
        "resource_key": "engineering-repo",
        "resource_label": "Engineering Repository",
        "device_name": "Noah-Dell-Latitude",
        "requested_action": "READ",
        "features": NORMAL_FEATURES,
        "attempts": 1,
        "require_incident": False,
    },
    {
        "scenario": "E",
        "title": "Repeated anomalies restrict session",
        "description": (
            "Leo Martins makes three high-risk Engineering Repository requests within the "
            "repeated-anomaly window, demonstrating escalation from step-up to session restriction."
        ),
        "expected_outcome": "RESTRICT with REPEATED_ANOMALIES and revoked sessions.",
        "expected_decision": "RESTRICT",
        "expected_reasons": ("REPEATED_ANOMALIES",),
        "subject_email": "leo.martins@aegisnexus.ai",
        "subject_label": "Leo Martins",
        "resource_key": "engineering-repo",
        "resource_label": "Engineering Repository",
        "device_name": "Leo-Linux-Workstation",
        "requested_action": "WRITE",
        "features": REPEATED_FEATURES,
        "attempts": 3,
        "require_incident": True,
    },
    {
        "scenario": "F",
        "title": "High-risk exfiltration denied",
        "description": (
            "Amara Okafor requests Finance Reports with exfiltration-like volume, unusual hours, "
            "new-device context, and sensitive-resource concentration."
        ),
        "expected_outcome": "DENY with RISK_POLICY_DENY and an investigation incident.",
        "expected_decision": "DENY",
        "expected_reasons": ("RISK_POLICY_DENY",),
        "subject_email": "amara.okafor@aegisnexus.ai",
        "subject_label": "Amara Okafor",
        "resource_key": "finance-reports",
        "resource_label": "Finance Reports",
        "device_name": "Amara-MacBook-Pro",
        "requested_action": "READ",
        "features": EXFILTRATION_FEATURES,
        "attempts": 1,
        "require_incident": True,
    },
]

SCENARIO_BY_ID = {definition["scenario"]: definition for definition in SCENARIO_DEFINITIONS}

RESET_DELETE_ORDER = (
    IncidentNote,
    Incident,
    AccessRequest,
    BehavioralEvent,
    UserSession,
    Device,
    AccessPolicy,
    Resource,
    SecurityEvent,
    Identity,
)


def list_demo_scenarios() -> list[DemoScenarioInfo]:
    return [
        DemoScenarioInfo(
            scenario=definition["scenario"],
            title=definition["title"],
            description=definition["description"],
            expected_outcome=definition["expected_outcome"],
            subject=definition["subject_label"],
            resource=definition["resource_label"],
            device=definition["device_name"],
        )
        for definition in SCENARIO_DEFINITIONS
    ]


def _load_context(db: Session, definition: dict[str, Any]):
    identity = db.scalar(
        select(Identity).where(Identity.email == definition["subject_email"])
    )
    resource = db.scalar(
        select(Resource).where(Resource.key == definition["resource_key"])
    )
    if identity is None or resource is None:
        raise ApiError(
            409,
            "DEMO_DATA_NOT_READY",
            "Demo data is not seeded. Run the demo seed before executing scenarios.",
        )
    device = db.scalar(
        select(Device).where(
            Device.identity_id == identity.id,
            Device.name == definition["device_name"],
        )
    )
    if device is None:
        raise ApiError(
            409,
            "DEMO_DATA_NOT_READY",
            f"Demo device '{definition['device_name']}' is unavailable.",
        )
    return identity, resource, device


def _ensure_session(db: Session, identity: Identity) -> None:
    if identity.status != "ACTIVE":
        return
    if active_session_count(db, identity.id):
        return
    create_session(
        db,
        identity,
        get_settings().session_ttl_minutes,
        ip_address="10.20.4.0",
        user_agent="AEGIS demo scenario session (simulated)",
        is_simulated=True,
    )


def _attempt_summary(outcome) -> dict[str, Any]:
    return {
        "request_id": outcome.access_request.id,
        "decision": outcome.access_request.decision,
        "risk_score": outcome.access_request.risk_score,
        "risk_category": outcome.access_request.risk_category,
        "reason_codes": [reason["code"] for reason in outcome.access_request.reasons or []],
    }


def _run_scenario(db: Session, definition: dict[str, Any], actor: Identity) -> DemoScenarioOut:
    identity, resource, device = _load_context(db, definition)
    outcomes = []
    for _ in range(definition["attempts"]):
        _ensure_session(db, identity)
        outcomes.append(
            evaluate_access(
                db,
                subject=identity,
                resource=resource,
                device=device,
                requested_action=definition["requested_action"],
                features=dict(definition["features"]),
                actor=actor,
                simulate=True,
            )
        )

    final = outcomes[-1]
    reason_codes = [reason["code"] for reason in final.access_request.reasons or []]
    incident_id = final.incident.id if final.incident else None
    passed = (
        final.access_request.decision == definition["expected_decision"]
        and all(code in reason_codes for code in definition["expected_reasons"])
        and all(outcome.access_request.is_simulated for outcome in outcomes)
        and (not definition["require_incident"] or incident_id is not None)
    )

    attempt_decisions = [outcome.access_request.decision for outcome in outcomes]
    if len(attempt_decisions) > 1:
        actual_outcome = (
            f"{final.access_request.decision} after {len(attempt_decisions)} evaluations "
            f"({', '.join(attempt_decisions)})."
        )
    else:
        actual_outcome = (
            f"{final.access_request.decision}: {', '.join(reason_codes) or 'NO_REASONS'}."
        )

    return DemoScenarioOut(
        scenario=definition["scenario"],
        title=definition["title"],
        description=definition["description"],
        expected_outcome=definition["expected_outcome"],
        actual_outcome=actual_outcome,
        passed=passed,
        request_id=final.access_request.id,
        incident_id=incident_id,
        decision=final.access_request.decision,
        risk_score=final.access_request.risk_score,
        details={
            "subject": definition["subject_label"],
            "resource": definition["resource_label"],
            "device": definition["device_name"],
            "requested_action": definition["requested_action"],
            "policy_version": final.access_request.policy_version,
            "reason_codes": reason_codes,
            "attempts": [_attempt_summary(outcome) for outcome in outcomes],
            "simulated": True,
        },
    )


def run_demo_scenarios(
    db: Session,
    *,
    actor: Identity,
    scenario: str | None = None,
) -> DemoRunOut:
    if scenario is not None and scenario not in SCENARIO_BY_ID:
        raise ApiError(404, "SCENARIO_NOT_FOUND", f"Unknown demo scenario '{scenario}'.")
    definitions = (
        [SCENARIO_BY_ID[scenario]] if scenario is not None else SCENARIO_DEFINITIONS
    )
    results = [_run_scenario(db, definition, actor) for definition in definitions]

    correlation_id = new_id()
    summaries = [
        {
            "scenario": result.scenario,
            "passed": result.passed,
            "decision": result.decision,
            "request_id": result.request_id,
        }
        for result in results
    ]
    passed = all(result.passed for result in results)
    record_event(
        db,
        event_type="DEMO_SCENARIO_RUN",
        category="Demo",
        summary=(
            f"Simulated demo scenario {scenario or 'ALL'} executed: "
            f"{sum(result.passed for result in results)}/{len(results)} passed"
        ),
        correlation_id=correlation_id,
        severity="LOW" if passed else "HIGH",
        actor_id=actor.id,
        details={"scenario": scenario or "ALL", "passed": passed, "results": summaries},
        is_simulated=True,
    )
    append_audit(
        db,
        actor=actor,
        action="DEMO_SCENARIO_RUN",
        target_type="demo",
        target_id=scenario,
        correlation_id=correlation_id,
        result="SUCCESS" if passed else "FAILURE",
        metadata={
            "scenario": scenario or "ALL",
            "passed": passed,
            "results": summaries,
            "simulated": True,
        },
    )
    db.flush()
    return DemoRunOut(
        scenario=scenario,
        results=results,
        executed_at=utcnow(),
        demo_mode=get_settings().demo_mode,
        is_simulated=True,
    )


def reset_demo_data(db: Session) -> DemoResetOut:
    for model in RESET_DELETE_ORDER:
        db.execute(delete(model))
    db.flush()

    seed_result = seed_demo_data(db)
    admin = db.scalar(select(Identity).where(Identity.email == "admin@aegisnexus.ai"))
    if admin is None:
        raise ApiError(500, "DEMO_RESET_FAILED", "Demo reset could not recreate the administrator.")

    correlation_id = new_id()
    record_event(
        db,
        event_type="DEMO_RESET",
        category="Demo",
        summary="Synthetic demonstration workspace reset; audit history preserved",
        correlation_id=correlation_id,
        severity="MEDIUM",
        actor_id=admin.id,
        details={
            "identities": seed_result.identities,
            "devices": seed_result.devices,
            "incidents": seed_result.incidents,
            "audit_history_preserved": True,
        },
        is_simulated=True,
    )
    append_audit(
        db,
        actor=admin,
        action="DEMO_RESET",
        target_type="environment",
        target_id=None,
        correlation_id=correlation_id,
        result="SUCCESS",
        metadata={
            "identities": seed_result.identities,
            "devices": seed_result.devices,
            "incidents": seed_result.incidents,
            "audit_history_preserved": True,
            "simulated": True,
        },
    )
    db.commit()
    return DemoResetOut(
        reset=seed_result.created,
        identities=seed_result.identities,
        devices=seed_result.devices,
        access_requests=seed_result.access_requests,
        incidents=seed_result.incidents,
        message=(
            "Demo workspace reset. Simulated identities, devices, policies, and incidents were "
            "recreated; the append-only audit history was preserved."
        ),
    )
