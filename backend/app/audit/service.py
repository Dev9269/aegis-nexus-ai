from __future__ import annotations

import hashlib
import json
import threading
from datetime import datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.time import as_utc
from app.models import AuditLog, Identity, new_id, utcnow

_chain_lock = threading.Lock()


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
