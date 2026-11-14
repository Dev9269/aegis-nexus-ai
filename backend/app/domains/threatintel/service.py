from __future__ import annotations

import random
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.audit.service import append_audit
from app.core.config import get_settings
from app.db.models import Identity, Incident, LeakFinding, Severity, new_id, utcnow
from app.domains.threatintel.schemas import (
    LeakFindingOut,
    SimulateLeakOut,
    ThreatIntelSummary,
)


SOURCE_TYPES = [
    ("PASTE_SITE", "Pastebin (public paste)"),
    ("CREDENTIAL_DUMP", "BreachForums credential dump"),
    ("COMBO_LIST", "Combo list (email:password)"),
    ("DARK_WEB_FORUM", "Dark web marketplace listing"),
    ("TELEGRAM_CHANNEL", "Telegram leak channel"),
]

MATCHED_FIELDS = ["email", "password_hash", "session_token", "api_key", "mfa_seed"]

REMEDIATIONS = {
    "email": "Force password reset and notify the user; enable MFA if not enrolled.",
    "password_hash": "Rotate credentials immediately; invalidate active sessions.",
    "session_token": "Revoke all sessions for the affected identity.",
    "api_key": "Revoke and reissue the API key; audit recent usage.",
    "mfa_seed": "Re-enroll MFA; treat as critical compromise.",
}


def _mask(value: str) -> str:
    if len(value) <= 4:
        return "****"
    return value[:2] + "*" * (len(value) - 4) + value[-2:]


def _to_out(f: LeakFinding, identity_name: str | None = None) -> LeakFindingOut:
    return LeakFindingOut(
        id=f.id,
        identity_id=f.identity_id,
        identity_name=identity_name,
        source_type=f.source_type,
        source_name=f.source_name,
        severity=f.severity,
        matched_field=f.matched_field,
        leaked_value_masked=f.leaked_value_masked,
        first_seen=f.first_seen,
        last_seen=f.last_seen,
        status=f.status,
        remediation=f.remediation,
        is_simulated=f.is_simulated,
    )


def _ensure_seeded(db: Session) -> None:
    count = db.scalar(select(func.count(LeakFinding.id))) or 0
    if count and count > 0:
        return
    identities = list(db.scalars(select(Identity).limit(8)).all())
    if not identities:
        return
    rng = random.Random(42)
    now = utcnow()
    for i in range(6):
        ident = identities[i % len(identities)]
        src_type, src_name = rng.choice(SOURCE_TYPES)
        field = rng.choice(MATCHED_FIELDS)
        sev = rng.choice(["LOW", "MEDIUM", "HIGH", "CRITICAL"])
        value = _mask(ident.email if field == "email" else f"tok_{ident.id[:8]}")
        finding = LeakFinding(
            id=new_id(),
            identity_id=ident.id,
            source_type=src_type,
            source_name=src_name,
            severity=sev,
            matched_field=field,
            leaked_value_masked=value,
            first_seen=now - timedelta(days=rng.randint(1, 30)),
            last_seen=now - timedelta(days=rng.randint(0, 5)),
            status=rng.choice(["NEW", "NEW", "TRIAGED"]),
            remediation=REMEDIATIONS.get(field, "Investigate and remediate."),
            is_simulated=True,
        )
        db.add(finding)
    db.commit()


def list_findings(
    db: Session,
    *,
    status: str | None = None,
    severity: str | None = None,
    identity_id: str | None = None,
    page: int = 1,
    page_size: int = 50,
) -> list[LeakFindingOut]:
    _ensure_seeded(db)
    stmt = select(LeakFinding)
    if status:
        stmt = stmt.where(LeakFinding.status == status)
    if severity:
        stmt = stmt.where(LeakFinding.severity == severity)
    if identity_id:
        stmt = stmt.where(LeakFinding.identity_id == identity_id)
    stmt = stmt.order_by(LeakFinding.first_seen.desc()).offset((page - 1) * page_size).limit(page_size)
    findings = list(db.scalars(stmt).all())
    name_map = {i.id: i.display_name for i in db.scalars(select(Identity)).all()}
    return [_to_out(f, name_map.get(f.identity_id)) for f in findings]


def get_summary(db: Session) -> ThreatIntelSummary:
    _ensure_seeded(db)
    total = db.scalar(select(func.count(LeakFinding.id))) or 0
    new = db.scalar(select(func.count(LeakFinding.id)).where(LeakFinding.status == "NEW")) or 0
    triaged = db.scalar(select(func.count(LeakFinding.id)).where(LeakFinding.status == "TRIAGED")) or 0
    resolved = db.scalar(select(func.count(LeakFinding.id)).where(LeakFinding.status == "RESOLVED")) or 0
    critical = db.scalar(select(func.count(LeakFinding.id)).where(LeakFinding.severity == "CRITICAL")) or 0
    high = db.scalar(select(func.count(LeakFinding.id)).where(LeakFinding.severity == "HIGH")) or 0
    return ThreatIntelSummary(total=total, new=new, triaged=triaged, resolved=resolved, critical=critical, high=high)


def simulate_leak(db: Session, *, actor, identity_id: str | None = None) -> SimulateLeakOut:
    if identity_id:
        ident = db.get(Identity, identity_id)
    else:
        ident = db.scalar(select(Identity).order_by(Identity.created_at).limit(1))
    if ident is None:
        raise ValueError("No identities available")
    rng = random.Random()
    src_type, src_name = rng.choice(SOURCE_TYPES)
    field = rng.choice(MATCHED_FIELDS)
    sev = rng.choice(["MEDIUM", "HIGH", "CRITICAL"])
    value = _mask(ident.email if field == "email" else f"tok_{ident.id[:8]}")
    finding = LeakFinding(
        id=new_id(),
        identity_id=ident.id,
        source_type=src_type,
        source_name=src_name,
        severity=sev,
        matched_field=field,
        leaked_value_masked=value,
        first_seen=utcnow(),
        last_seen=utcnow(),
        status="NEW",
        remediation=REMEDIATIONS.get(field, "Investigate and remediate."),
        is_simulated=True,
    )
    db.add(finding)

    # auto-create incident for high/critical
    incident_id = None
    if sev in ("HIGH", "CRITICAL"):
        inc = Incident(
            id=new_id(),
            title=f"Leaked credential detected - {ident.display_name}",
            classification="Credential exposure on dark web",
            severity=Severity.HIGH.value if sev == "HIGH" else Severity.CRITICAL.value,
            status="OPEN",
            identity_id=ident.id,
            summary=f"Leak finding {finding.id[:8]}: {field} exposed via {src_name}.",
            related_access_request_ids=[],
            related_device_ids=[],
            is_simulated=True,
        )
        db.add(inc)
        incident_id = inc.id

    append_audit(
        db,
        actor=actor,
        action="THREAT_INTEL_LEAK_SIMULATED",
        target_type="leak_finding",
        target_id=finding.id,
        correlation_id=new_id(),
        result="SUCCESS",
        metadata={"identity_id": ident.id, "severity": sev, "source": src_name},
    )
    db.commit()
    db.refresh(finding)
    name_map = {ident.id: ident.display_name}
    return SimulateLeakOut(
        finding=_to_out(finding, name_map.get(finding.identity_id)),
        incident_id=incident_id,
        message=f"New leak finding recorded for {ident.display_name} ({sev}).",
    )


def update_finding(db: Session, *, finding_id: str, status: str, actor) -> LeakFindingOut:
    f = db.get(LeakFinding, finding_id)
    if f is None:
        raise ValueError("Finding not found")
    f.status = status
    f.last_seen = utcnow()
    append_audit(
        db,
        actor=actor,
        action="THREAT_INTEL_FINDING_UPDATED",
        target_type="leak_finding",
        target_id=f.id,
        correlation_id=new_id(),
        result="SUCCESS",
        metadata={"status": status},
    )
    db.commit()
    db.refresh(f)
    name_map = {}
    if f.identity_id:
        ident = db.get(Identity, f.identity_id)
        if ident:
            name_map[f.identity_id] = ident.display_name
    return _to_out(f, name_map.get(f.identity_id))