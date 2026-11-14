from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.audit.service import verify_audit_chain
from app.core.pdf import render_pdf
from app.db.models import AccessRequest, Identity, Incident
from app.domains.reports.schemas import ExecutiveReport, ReportMetric, ReportSection
from app.domains.threatintel.service import get_summary as threat_summary
from app.ml.runtime import get_metadata, model_available
from app.security.sessions import active_session_count


def _decision_counts(db: Session) -> dict[str, int]:
    rows = db.execute(
        select(AccessRequest.decision, func.count(AccessRequest.id)).group_by(
            AccessRequest.decision
        )
    ).all()
    return {decision: int(count) for decision, count in rows}


def _incident_counts(db: Session) -> dict[str, int]:
    rows = db.execute(
        select(Incident.status, func.count(Incident.id)).group_by(Incident.status)
    ).all()
    return {status: int(count) for status, count in rows}


def build_executive_report(db: Session) -> ExecutiveReport:
    now = datetime.now(timezone.utc)
    identities = int(db.scalar(select(func.count(Identity.id))) or 0)
    disabled = int(
        db.scalar(select(func.count(Identity.id)).where(Identity.status == "DISABLED")) or 0
    )
    sessions = active_session_count(db)
    model_version = (
        get_metadata().get("model_version", "unknown") if model_available() else "not trained"
    )

    decisions = _decision_counts(db)
    total_requests = sum(decisions.values())
    denied = decisions.get("DENY", 0)
    deny_rate = round(denied / total_requests * 100, 1) if total_requests else 0.0
    high_risk = int(
        db.scalar(
            select(func.count(AccessRequest.id)).where(
                AccessRequest.risk_category.in_(["HIGH", "CRITICAL"])
            )
        )
        or 0
    )

    incidents = _incident_counts(db)
    open_incidents = incidents.get("OPEN", 0) + incidents.get("INVESTIGATING", 0)
    contained = incidents.get("CONTAINED", 0)
    resolved = incidents.get("RESOLVED", 0)
    false_positive = incidents.get("FALSE_POSITIVE", 0)

    leaks = threat_summary(db)

    chain_ok, audit_entries, _, chain_message = verify_audit_chain(db)

    top_risk = list(
        db.scalars(select(Identity).order_by(Identity.current_risk.desc()).limit(5))
    )

    if contained or open_incidents >= 3 or leaks.critical:
        overall_risk = "ELEVATED"
    elif open_incidents or leaks.high:
        overall_risk = "GUARDED"
    else:
        overall_risk = "NOMINAL"

    sections = [
        ReportSection(
            title="Identity and access posture",
            metrics=[
                ReportMetric(label="Managed identities", value=str(identities)),
                ReportMetric(label="Disabled identities", value=str(disabled)),
                ReportMetric(label="Active sessions", value=str(sessions)),
                ReportMetric(label="Anomaly model", value=model_version),
            ],
            bullets=[
                "Every access decision is re-authenticated and re-authorized (zero trust).",
                "Employees are restricted to their own records; staff roles are enforced server-side.",
            ],
        ),
        ReportSection(
            title="Access decisions",
            metrics=[
                ReportMetric(label="Total decisions", value=str(total_requests)),
                ReportMetric(label="Denied", value=str(denied)),
                ReportMetric(label="Challenged", value=str(decisions.get("CHALLENGE", 0))),
                ReportMetric(label="Deny rate", value=f"{deny_rate}%"),
            ],
            bullets=[
                f"{high_risk} high or critical risk requests were observed.",
                "The policy engine is the final authority; the model cannot override a deny.",
            ],
        ),
        ReportSection(
            title="Incident response",
            metrics=[
                ReportMetric(label="Open / investigating", value=str(open_incidents)),
                ReportMetric(label="Contained", value=str(contained)),
                ReportMetric(label="Resolved", value=str(resolved)),
                ReportMetric(label="False positive", value=str(false_positive)),
            ],
            bullets=[
                "Incidents are auto-created for critical risk or policy containment.",
                "Response playbooks disable identities, revoke sessions, and restrict devices.",
            ],
        ),
        ReportSection(
            title="Threat intelligence",
            metrics=[
                ReportMetric(label="Leak findings", value=str(leaks.total)),
                ReportMetric(label="New", value=str(leaks.new)),
                ReportMetric(label="Critical", value=str(leaks.critical)),
                ReportMetric(label="High", value=str(leaks.high)),
            ],
            bullets=[
                "Exposure monitoring covers paste sites, combo lists, and dark-web channels.",
                "Remediation rotates credentials and revokes affected sessions.",
            ],
        ),
        ReportSection(
            title="Compliance and evidence",
            metrics=[
                ReportMetric(label="Framework", value="SOC 2 (prototype)"),
                ReportMetric(label="Audit entries", value=str(audit_entries)),
                ReportMetric(
                    label="Audit chain", value="INTACT" if chain_ok else "COMPROMISED"
                ),
            ],
            bullets=[
                chain_message,
                "Audit records are append-only and hash-chained (SHA-256).",
            ],
        ),
        ReportSection(
            title="Highest-risk identities",
            metrics=[
                ReportMetric(label=row.display_name, value=f"{row.current_risk:.0f}")
                for row in top_risk
            ]
            or [ReportMetric(label="None", value="0")],
        ),
    ]

    highlights = [
        f"{identities} identities under management, {disabled} disabled.",
        f"{denied}/{total_requests} access requests denied ({deny_rate}% deny rate).",
        f"{open_incidents} open investigations; {contained} contained this period.",
        f"{leaks.total} leak finding(s); {leaks.critical} critical.",
        f"Audit ledger integrity: {'verified' if chain_ok else 'FAILED'} ({audit_entries} entries).",
    ]

    return ExecutiveReport(
        generated_at=now.isoformat(),
        organization="AEGIS NEXUS — Zero-Trust Security Platform",
        headline=(
            f"Security posture is {overall_risk}. {open_incidents} open investigations, "
            f"{denied} denied requests, {leaks.total} leak findings."
        ),
        overall_risk=overall_risk,
        highlights=highlights,
        sections=sections,
    )


def render_executive_pdf(report: ExecutiveReport) -> bytes:
    blocks: list[tuple[str, str]] = [
        ("title", "AEGIS NEXUS"),
        ("h2", "Executive Security Report"),
        ("note", f"Generated {report.generated_at}"),
        ("spacer", ""),
        ("body", f"Overall risk: {report.overall_risk}"),
        ("body", report.headline),
        ("spacer", ""),
        ("h2", "Executive highlights"),
    ]
    for highlight in report.highlights:
        blocks.append(("bullet", highlight))
    blocks.append(("spacer", ""))

    for section in report.sections:
        blocks.append(("h2", section.title))
        for metric in section.metrics:
            blocks.append(("kv", f"{metric.label}: {metric.value}"))
        for bullet in section.bullets:
            blocks.append(("bullet", bullet))
        blocks.append(("spacer", ""))

    blocks.append(("spacer", ""))
    blocks.append(
        (
            "note",
            "This report is generated from live platform state. Prototype system: figures "
            "reflect simulated and real demo data and are not a production attestation.",
        )
    )
    return render_pdf(blocks)
