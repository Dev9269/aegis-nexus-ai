from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models import Device, Identity, Resource
from app.domains.access.router import EvaluateAccessIn  # noqa - just for type
from app.domains.access.schemas import BehaviorFeatures, EvaluateAccessIn
from app.domains.access.service import evaluate_access_request
from app.domains.redteam.schemas import (
    RedTeamAttack,
    RedTeamRunOut,
    RedTeamScenario,
    RedTeamScenarioResult,
)


SCENARIOS = [
    RedTeamScenario(
        id="credential_stuffing",
        name="Credential Stuffing",
        description="Attacker replays leaked credentials against many accounts with a new device and foreign IP.",
        severity="CRITICAL",
    ),
    RedTeamScenario(
        id="impossible_travel",
        name="Impossible Travel",
        description="Same identity authenticates from two geographically distant locations within minutes.",
        severity="HIGH",
    ),
    RedTeamScenario(
        id="privilege_escalation",
        name="Privilege Escalation",
        description="Low-privilege employee attempts an admin action on the security console.",
        severity="CRITICAL",
    ),
    RedTeamScenario(
        id="brute_force",
        name="Brute Force",
        description="Repeated failed login attempts against a single account.",
        severity="HIGH",
    ),
    RedTeamScenario(
        id="session_hijack",
        name="Session Hijack",
        description="Stolen session token used from a new device with abnormal session length.",
        severity="HIGH",
    ),
    RedTeamScenario(
        id="insider_exfiltration",
        name="Insider Exfiltration",
        description="Insider accesses an unusually high number of sensitive resources in a short window.",
        severity="MEDIUM",
    ),
]


def _identity(db, role=None, email_contains=None):
    stmt = select(Identity)
    if role:
        stmt = stmt.where(Identity.role == role)
    if email_contains:
        stmt = stmt.where(Identity.email.ilike(f"%{email_contains}%"))
    return db.scalar(stmt.order_by(Identity.created_at).limit(1))


def _resource(db, key):
    return db.scalar(select(Resource).where(Resource.key == key))


def _device(db, identity_id):
    return db.scalar(select(Device).where(Device.identity_id == identity_id).limit(1))


def _features(**kw):
    base = {
        "login_hour": 10,
        "day_of_week": 1,
        "failed_logins_15m": 0,
        "requests_1h": 5,
        "distinct_resources_1h": 2,
        "sensitive_access_ratio": 0.1,
        "new_device": False,
        "geo_novelty": False,
        "session_duration_min": 20,
        "activity_deviation": 0.2,
    }
    base.update(kw)
    return base


def _run_one(db, auth, subject, resource, device, action, features):
    payload = EvaluateAccessIn(
        identity_id=subject.id,
        resource_id=resource.id,
        device_id=device.id if device else None,
        requested_action=action,
        features=BehaviorFeatures(**features),
        simulate=True,
    )
    out = evaluate_access_request(db, payload=payload, auth=auth)
    return RedTeamAttack(
        name="",
        identity_email=subject.email,
        resource_name=resource.name,
        requested_action=action,
        decision=out.decision,
        risk_score=out.risk_score,
        risk_category=out.risk_category,
        blocked=out.decision in ("DENY", "RESTRICT", "CHALLENGE"),
        explanation=out.explanation,
        confidence=out.confidence,
    )


def _attacks_for(scenario_id, db, auth):
    emp = _identity(db, role="EMPLOYEE")
    admin = _identity(db, role="SECURITY_ADMIN")
    res_finance = _resource(db, "finance-reports")
    res_security = _resource(db, "security-console")
    res_hr = _resource(db, "hr-records")
    emp_dev = _device(db, emp.id) if emp else None
    admin_dev = _device(db, admin.id) if admin else None
    attacks = []

    if scenario_id == "credential_stuffing":
        if emp and res_finance and emp_dev:
            a = _run_one(db, auth, emp, res_finance, emp_dev, "READ", _features(failed_logins_15m=20, new_device=True, geo_novelty=True, login_hour=3, activity_deviation=0.9))
            a.name = "Replay leaked creds from new device"
            attacks.append(a)
    elif scenario_id == "impossible_travel":
        if admin and res_security and admin_dev:
            a = _run_one(db, auth, admin, res_security, admin_dev, "READ", _features(geo_novelty=True, new_device=True, activity_deviation=0.99, login_hour=2, failed_logins_15m=12, requests_1h=90, distinct_resources_1h=18, sensitive_access_ratio=0.9, session_duration_min=480))
            a.name = "Admin login from impossible location"
            attacks.append(a)
    elif scenario_id == "privilege_escalation":
        if emp and res_security:
            a = _run_one(db, auth, emp, res_security, emp_dev, "ADMIN", _features())
            a.name = "Employee requests ADMIN on security console"
            attacks.append(a)
    elif scenario_id == "brute_force":
        if emp and res_finance and emp_dev:
            a = _run_one(db, auth, emp, res_finance, emp_dev, "READ", _features(failed_logins_15m=80, new_device=True, geo_novelty=True, login_hour=3, activity_deviation=0.95))
            a.name = "80 failed logins in 15 minutes"
            attacks.append(a)
    elif scenario_id == "session_hijack":
        if admin and res_security and admin_dev:
            a = _run_one(db, auth, admin, res_security, admin_dev, "READ", _features(new_device=True, session_duration_min=480, activity_deviation=0.85))
            a.name = "Stolen session from new device"
            attacks.append(a)
    elif scenario_id == "insider_exfiltration":
        if emp and res_hr and emp_dev:
            a = _run_one(db, auth, emp, res_hr, emp_dev, "READ", _features(sensitive_access_ratio=0.99, distinct_resources_1h=40, requests_1h=200, new_device=True, geo_novelty=True, login_hour=1, activity_deviation=0.99, failed_logins_15m=8))
            a.name = "Mass sensitive data access"
            attacks.append(a)
    return attacks


def run_red_team(db, *, actor, scenario_id: str | None = None) -> RedTeamRunOut:
    auth = type("Auth", (), {"identity": actor})()  # duck-typed AuthContext-like
    # evaluate_access_request expects auth.identity and auth.identity.role
    # We need role check: simulate requires staff. actor is staff (admin). OK.
    # But evaluate_access_request checks auth.identity.role. Ensure actor has role attr.
    selected = SCENARIOS if scenario_id is None else [s for s in SCENARIOS if s.id == scenario_id]
    results = []
    total = 0
    blocked = 0
    for sc in selected:
        attacks = _attacks_for(sc.id, db, auth)
        bc = sum(1 for a in attacks if a.blocked)
        total += len(attacks)
        blocked += bc
        results.append(RedTeamScenarioResult(
            scenario=sc,
            attacks=attacks,
            blocked_count=bc,
            total_count=len(attacks),
            defended=(bc == len(attacks) and len(attacks) > 0),
        ))
    overall = "DEFENDED" if (blocked == total and total > 0) else "PARTIAL"
    db.commit()
    return RedTeamRunOut(results=results, total_attacks=total, blocked_attacks=blocked, overall=overall)


def list_scenarios() -> list[RedTeamScenario]:
    return list(SCENARIOS)