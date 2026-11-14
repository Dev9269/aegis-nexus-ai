from __future__ import annotations

from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import (
    AccessRequest,
    AuditLog,
    Device,
    Identity,
    Incident,
    UserSession,
    utcnow,
)
from app.domains.copilot.schemas import CopilotAnswer
from app.domains.redteam.service import list_scenarios
from app.domains.threatintel.service import get_summary as threat_summary
from app.ml.runtime import get_metadata, model_available
from app.security.sessions import active_session_count

SEVERITY_ORDER = {"LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}

SUGGESTIONS = [
    "What is our current security posture?",
    "Which identities are highest risk?",
    "Show me open incidents",
    "Any leaked credentials?",
    "How many access requests were denied?",
    "Are there untrusted devices?",
    "How is compliance looking?",
]


def _has(text: str, *words: str) -> bool:
    return any(word in text for word in words)


def _posture(db: Session) -> tuple[str, list[str], dict]:
    identities = int(db.scalar(select(func.count(Identity.id))) or 0)
    disabled = int(
        db.scalar(select(func.count(Identity.id)).where(Identity.status == "DISABLED")) or 0
    )
    open_incidents = int(
        db.scalar(
            select(func.count(Incident.id)).where(
                Incident.status.in_(["OPEN", "INVESTIGATING"])
            )
        )
        or 0
    )
    total_requests = int(db.scalar(select(func.count(AccessRequest.id))) or 0)
    denied = int(
        db.scalar(
            select(func.count(AccessRequest.id)).where(AccessRequest.decision == "DENY")
        )
        or 0
    )
    leaks = threat_summary(db)
    sessions = active_session_count(db)
    deny_rate = round(denied / total_requests * 100, 1) if total_requests else 0.0
    model = get_metadata().get("model_version", "unknown") if model_available() else "not trained"

    answer = (
        f"Posture snapshot: {identities} identities ({disabled} disabled), "
        f"{sessions} active sessions, {open_incidents} open investigations, "
        f"{denied}/{total_requests} requests denied ({deny_rate}% deny rate). "
        f"Threat intel shows {leaks.total} leak finding(s), {leaks.critical} critical."
    )
    bullets = [
        f"Anomaly model: {model}",
        f"Open investigations: {open_incidents}",
        f"Deny rate: {deny_rate}%",
        f"Leak findings: {leaks.total} total / {leaks.new} new",
    ]
    data = {
        "identities": identities,
        "disabled_identities": disabled,
        "active_sessions": sessions,
        "open_incidents": open_incidents,
        "total_requests": total_requests,
        "denied_requests": denied,
        "deny_rate": deny_rate,
        "leaks": leaks.model_dump(),
        "model_version": model,
    }
    return answer, bullets, data


def _risky_identities(db: Session) -> tuple[str, list[str], dict]:
    rows = list(
        db.scalars(select(Identity).order_by(Identity.current_risk.desc()).limit(5))
    )
    bullets = [
        f"{row.display_name} ({row.role}) — risk {row.current_risk:.0f}"
        for row in rows
    ] or ["No identities with elevated risk."]
    answer = (
        f"The highest-risk identity is {rows[0].display_name} at risk "
        f"{rows[0].current_risk:.0f}." if rows else "No identities found."
    )
    data = {
        "identities": [
            {
                "id": row.id,
                "name": row.display_name,
                "role": row.role,
                "risk_score": row.current_risk,
                "status": row.status,
            }
            for row in rows
        ]
    }
    return answer, bullets, data


def _open_incidents(db: Session) -> tuple[str, list[str], dict]:
    rows = list(
        db.scalars(
            select(Incident)
            .where(Incident.status.in_(["OPEN", "INVESTIGATING"]))
            .order_by(Incident.created_at.desc())
            .limit(50)
        )
    )
    rows.sort(key=lambda i: SEVERITY_ORDER.get(i.severity, 0), reverse=True)
    top = rows[:5]
    bullets = [
        f"[{row.severity}] {row.title} — {row.status}" for row in top
    ] or ["No open investigations. The queue is clear."]
    answer = f"There are {len(rows)} open investigation(s) needing attention."
    data = {
        "open_count": len(rows),
        "incidents": [
            {
                "id": row.id,
                "title": row.title,
                "severity": row.severity,
                "status": row.status,
                "identity_id": row.identity_id,
            }
            for row in top
        ],
    }
    return answer, bullets, data


def _leaks(db: Session) -> tuple[str, list[str], dict]:
    summary = threat_summary(db)
    answer = (
        f"Threat intel has {summary.total} leak finding(s): {summary.new} new, "
        f"{summary.triaged} triaged, {summary.resolved} resolved."
    )
    bullets = [
        f"{summary.critical} critical and {summary.high} high severity findings",
        "Open the Threat intel workspace to triage and trigger containment.",
    ]
    return answer, bullets, summary.model_dump()


def _access_denials(db: Session) -> tuple[str, list[str], dict]:
    since = utcnow() - timedelta(hours=24)
    total = int(db.scalar(select(func.count(AccessRequest.id))) or 0)
    denied = int(
        db.scalar(
            select(func.count(AccessRequest.id)).where(AccessRequest.decision == "DENY")
        )
        or 0
    )
    challenged = int(
        db.scalar(
            select(func.count(AccessRequest.id)).where(
                AccessRequest.decision == "CHALLENGE"
            )
        )
        or 0
    )
    denied_24h = int(
        db.scalar(
            select(func.count(AccessRequest.id)).where(
                AccessRequest.decision == "DENY",
                AccessRequest.created_at >= since,
            )
        )
        or 0
    )
    answer = (
        f"{denied} of {total} access requests were denied and {challenged} were "
        f"challenged. {denied_24h} denials in the last 24 hours."
    )
    bullets = [
        f"Total decisions evaluated: {total}",
        f"Denied: {denied} | Challenged: {challenged}",
        f"Denials (24h): {denied_24h}",
    ]
    data = {
        "total": total,
        "denied": denied,
        "challenged": challenged,
        "denied_24h": denied_24h,
    }
    return answer, bullets, data


def _sessions(db: Session) -> tuple[str, list[str], dict]:
    active = active_session_count(db)
    total = int(db.scalar(select(func.count(UserSession.id))) or 0)
    answer = f"There are {active} active session(s) out of {total} issued."
    bullets = [
        f"Active (unrevoked, unexpired): {active}",
        f"Revoked or expired: {total - active}",
    ]
    return answer, bullets, {"active": active, "total": total}


def _devices(db: Session) -> tuple[str, list[str], dict]:
    rows = db.execute(
        select(Device.state, func.count(Device.id)).group_by(Device.state)
    ).all()
    counts = {state: int(count) for state, count in rows}
    total = sum(counts.values())
    untrusted = counts.get("UNVERIFIED", 0) + counts.get("RESTRICTED", 0)
    answer = (
        f"{total} enrolled device(s); {untrusted} are not trusted "
        f"({counts.get('UNVERIFIED', 0)} unverified, {counts.get('RESTRICTED', 0)} restricted)."
    )
    bullets = [f"{state}: {count}" for state, count in sorted(counts.items())] or [
        "No devices enrolled."
    ]
    data = {"counts": counts, "total": total, "untrusted": untrusted}
    return answer, bullets, data


def _compliance(db: Session) -> tuple[str, list[str], dict]:
    audit_entries = int(db.scalar(select(func.count(AuditLog.id))) or 0)
    disabled = int(
        db.scalar(select(func.count(Identity.id)).where(Identity.status == "DISABLED")) or 0
    )
    sessions = active_session_count(db)
    answer = (
        "Prototype SOC 2 control coverage is passing: role-based access, scrypt hashing, "
        f"hash-chained audit ({audit_entries} entries), and incident response are all active."
    )
    bullets = [
        f"Audit ledger entries: {audit_entries}",
        f"Disabled identities: {disabled}",
        f"Active sessions: {sessions}",
        "Generate the executive PDF for a shareable summary.",
    ]
    data = {
        "framework": "SOC 2 (prototype)",
        "audit_entries": audit_entries,
        "disabled_identities": disabled,
        "active_sessions": sessions,
    }
    return answer, bullets, data


def _redteam(db: Session) -> tuple[str, list[str], dict]:
    scenarios = list_scenarios()
    bullets = [f"{s.name} ({s.severity})" for s in scenarios]
    answer = (
        f"{len(scenarios)} adversarial scenarios are available. Run them from the Red team "
        "workspace to validate the policy engine against live state."
    )
    data = {"scenarios": [s.model_dump() for s in scenarios]}
    return answer, bullets, data


def _help() -> tuple[str, list[str], dict]:
    answer = (
        "I am the AEGIS analyst copilot. I answer questions about live posture, risk, "
        "incidents, leaks, access decisions, sessions, devices, compliance, and red-team coverage. "
        "I am strictly read-only — I never change state."
    )
    return answer, list(SUGGESTIONS), {}


_INTENTS = [
    ("risky_identities", ("risky", "highest risk", "top risk", "dangerous", "who is risky", "risk leader", "riskiest")),
    ("open_incidents", ("incident", "investigation", "case", "triage", "open ticket")),
    ("leaks", ("leak", "dark web", "darkweb", "breach", "exposed", "credential dump", "combo list")),
    ("access_denials", ("denied", "deny", "denial", "blocked", "challenge", "access request")),
    ("sessions", ("session", "logged in", "active user", "login")),
    ("devices", ("device", "endpoint", "untrusted", "attestation")),
    ("compliance", ("compliance", "soc2", "soc 2", "control", "audit", "gdpr", "hipaa")),
    ("redteam", ("red team", "redteam", "attack", "penetration", "adversary", "scenario")),
    ("posture", ("posture", "overview", "summary", "status", "how are we", "situation", "health")),
]


def ask(db: Session, *, question: str) -> CopilotAnswer:
    q = question.strip().lower()
    if not q or _has(q, "help", "what can you do", "who are you", "commands"):
        answer, bullets, data = _help()
        return CopilotAnswer(
            question=question, intent="help", answer=answer, bullets=bullets,
            suggestions=SUGGESTIONS, data=data,
        )

    intent = "posture"
    for name, keywords in _INTENTS:
        if _has(q, *keywords):
            intent = name
            break

    handlers = {
        "posture": lambda: _posture(db),
        "risky_identities": lambda: _risky_identities(db),
        "open_incidents": lambda: _open_incidents(db),
        "leaks": lambda: _leaks(db),
        "access_denials": lambda: _access_denials(db),
        "sessions": lambda: _sessions(db),
        "devices": lambda: _devices(db),
        "compliance": lambda: _compliance(db),
        "redteam": lambda: _redteam(db),
    }
    answer, bullets, data = handlers[intent]()

    return CopilotAnswer(
        question=question,
        intent=intent,
        answer=answer,
        bullets=bullets,
        suggestions=[s for s in SUGGESTIONS if s.lower() != q][:4],
        data=data,
    )
