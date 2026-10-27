from __future__ import annotations

import csv
import hashlib
import io
import json
import threading
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.schemas import Page
from app.core.csv import csv_safe
from app.core.pagination import page_response
from app.core.time import as_utc, parse_optional_utc
from app.db.models import AuditLog, Identity, new_id, utcnow
from app.domains.audit import repository
from app.domains.audit.presenters import audit_out
from app.domains.audit.schemas import AuditOut

_chain_lock = threading.Lock()

AUDIT_EXPORT_HEADERS = [
    "sequence",
    "timestamp",
    "actor",
    "action",
    "target_type",
    "target_id",
    "result",
    "policy_version",
    "correlation_id",
    "prev_hash",
    "record_hash",
]


@dataclass(frozen=True)
class CsvExport:
    content: str
    filename: str
    correlation_id: str


def _canonical_payload(record: AuditLog) -> str:
    payload = {
        "id": record.id,
        "sequence": record.sequence,
        "timestamp": (as_utc(record.timestamp) or record.timestamp).isoformat(),
        "actor_id": record.actor_id,
        "actor_label": record.actor_label,
        "action": record.action,
        "target_type": record.target_type,
        "target_id": record.target_id,
        "result": record.result,
        "policy_version": record.policy_version,
        "correlation_id": record.correlation_id,
        "metadata": record.metadata_json or {},
    }
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)


def append_audit(
    db: Session,
    *,
    actor: Identity | None,
    actor_label: str | None = None,
    action: str,
    target_type: str,
    target_id: str | None,
    correlation_id: str,
    result: str = "SUCCESS",
    policy_version: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> AuditLog:
    with _chain_lock:
        previous = db.scalar(select(AuditLog).order_by(AuditLog.sequence.desc()).limit(1))
        sequence = (previous.sequence + 1) if previous else 1
        prev_hash = previous.record_hash if previous else "GENESIS"
        record = AuditLog(
            id=new_id(),
            sequence=sequence,
            timestamp=utcnow(),
            actor_id=actor.id if actor else None,
            actor_label=actor_label or (actor.display_name if actor else "system"),
            action=action,
            target_type=target_type,
            target_id=target_id,
            result=result,
            policy_version=policy_version,
            correlation_id=correlation_id,
            metadata_json=metadata or {},
            prev_hash=prev_hash,
            record_hash="pending",
        )
        record.record_hash = hashlib.sha256(
            f"{prev_hash}:{_canonical_payload(record)}".encode("utf-8")
        ).hexdigest()
        db.add(record)
        db.flush()
        return record


def verify_audit_chain(db: Session) -> tuple[bool, int, str | None, str]:
    records = list(db.scalars(select(AuditLog).order_by(AuditLog.sequence.asc())))
    previous_hash = "GENESIS"
    for index, record in enumerate(records, start=1):
        if record.sequence != index:
            return False, len(records), record.id, "Audit sequence gap detected"
        expected = hashlib.sha256(
            f"{previous_hash}:{_canonical_payload(record)}".encode("utf-8")
        ).hexdigest()
        if record.prev_hash != previous_hash or record.record_hash != expected:
            return False, len(records), record.id, "Audit hash chain mismatch detected"
        previous_hash = record.record_hash
    return True, len(records), None, "Audit hash chain verified"


def audit_count(db: Session) -> int:
    return int(db.scalar(select(func.count(AuditLog.id))) or 0)


def last_audit_at(db: Session) -> datetime | None:
    return db.scalar(select(AuditLog.timestamp).order_by(AuditLog.sequence.desc()).limit(1))


def build_audit_filters(filters: dict[str, Any]) -> list[Any]:
    conditions: list[Any] = []
    q = filters.get("q")
    if q:
        pattern = f"%{q.strip()}%"
        conditions.append(
            or_(
                AuditLog.actor_label.ilike(pattern),
                AuditLog.action.ilike(pattern),
                AuditLog.target_type.ilike(pattern),
                AuditLog.target_id.ilike(pattern),
                AuditLog.correlation_id.ilike(pattern),
            )
        )
    action = filters.get("action")
    if action:
        conditions.append(AuditLog.action == action)
    actor_id = filters.get("actor_id")
    if actor_id:
        conditions.append(AuditLog.actor_id == actor_id)
    target_type = filters.get("target_type")
    if target_type:
        conditions.append(AuditLog.target_type == target_type)
    start = parse_optional_utc(filters.get("from_time"), "from_time")
    end = parse_optional_utc(filters.get("to_time"), "to_time")
    if start:
        conditions.append(AuditLog.timestamp >= start)
    if end:
        conditions.append(AuditLog.timestamp <= end)
    return conditions


def list_audit(
    db: Session, *, filters: dict[str, Any], page: int, page_size: int
) -> Page[AuditOut]:
    rows, total = repository.list_audit_rows(
        db,
        build_audit_filters(filters),
        page=page,
        page_size=page_size,
    )
    return page_response(
        [audit_out(row) for row in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


def export_audit(db: Session, *, actor: Identity, filters: dict[str, Any]) -> CsvExport:
    rows = repository.list_audit_export_rows(
        db,
        build_audit_filters(filters),
        limit=10000,
    )
    csv_rows = [
        [
            row.sequence,
            row.timestamp.isoformat() if row.timestamp else "",
            row.actor_label,
            row.action,
            row.target_type,
            row.target_id,
            row.result,
            row.policy_version,
            row.correlation_id,
            row.prev_hash,
            row.record_hash,
        ]
        for row in rows
    ]

    correlation_id = new_id()
    append_audit(
        db,
        actor=actor,
        action="EXPORT_AUDIT_LOG",
        target_type="audit_log",
        target_id=None,
        correlation_id=correlation_id,
        result="SUCCESS",
        metadata={
            "row_count": len(rows),
            "filters": {"action": filters.get("action"), "q": bool(filters.get("q"))},
        },
    )
    db.commit()

    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(AUDIT_EXPORT_HEADERS)
    for row in csv_rows:
        writer.writerow([csv_safe(value) for value in row])

    return CsvExport(
        content=output.getvalue(),
        filename="aegis-audit-log.csv",
        correlation_id=correlation_id,
    )
