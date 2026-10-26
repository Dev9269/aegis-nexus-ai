from __future__ import annotations

import csv
import io
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import AuthContext, require_roles
from app.audit.service import append_audit, verify_audit_chain
from app.core.database import get_db
from app.core.errors import ApiError
from app.models import AuditLog, new_id
from app.schemas import AuditOut, AuditVerifyOut, Page

router = APIRouter(prefix="/audit", tags=["audit"])
STAFF_ROLES = ("SECURITY_ADMIN", "SECURITY_ANALYST", "AUDITOR")


def _parse_time(value: str | None, field: str) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ApiError(422, "INVALID_TIME_FILTER", f"{field} must be an ISO 8601 timestamp.") from exc
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _filters(
    *,
    q: str | None,
    action: str | None,
    actor_id: str | None,
    target_type: str | None,
    from_time: str | None,
    to_time: str | None,
) -> list:
    filters = []
    if q:
        pattern = f"%{q.strip()}%"
        filters.append(
            or_(
                AuditLog.actor_label.ilike(pattern),
                AuditLog.action.ilike(pattern),
                AuditLog.target_type.ilike(pattern),
                AuditLog.target_id.ilike(pattern),
                AuditLog.correlation_id.ilike(pattern),
            )
        )
    if action:
        filters.append(AuditLog.action == action)
    if actor_id:
        filters.append(AuditLog.actor_id == actor_id)
    if target_type:
        filters.append(AuditLog.target_type == target_type)
    start = _parse_time(from_time, "from_time")
    end = _parse_time(to_time, "to_time")
    if start:
        filters.append(AuditLog.timestamp >= start)
    if end:
        filters.append(AuditLog.timestamp <= end)
    return filters


def _csv_safe(value: object) -> str:
    text = "" if value is None else str(value)
    if text.startswith(("=", "+", "-", "@")):
        return f"'{text}"
    return text


@router.get("", response_model=Page[AuditOut])
def list_audit(
    q: str | None = Query(default=None, max_length=120),
    action: str | None = Query(default=None, max_length=80),
    actor_id: str | None = Query(default=None, max_length=36),
    target_type: str | None = Query(default=None, max_length=60),
    from_time: str | None = Query(default=None, max_length=40),
    to_time: str | None = Query(default=None, max_length=40),
    page: int = Query(default=1, ge=1, le=10000),
    page_size: int = Query(default=25, ge=1, le=100),
    auth: AuthContext = Depends(require_roles(*STAFF_ROLES)),
    db: Session = Depends(get_db),
) -> Page[AuditOut]:
    filters = _filters(
        q=q,
        action=action,
        actor_id=actor_id,
        target_type=target_type,
        from_time=from_time,
        to_time=to_time,
    )
    query = select(AuditLog)
    count_query = select(func.count(AuditLog.id))
    if filters:
        query = query.where(*filters)
        count_query = count_query.where(*filters)
    total = int(db.scalar(count_query) or 0)
    rows = list(
        db.scalars(
            query.order_by(AuditLog.sequence.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    )
    return Page(
        items=[AuditOut.model_validate(row) for row in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/verify", response_model=AuditVerifyOut)
def verify_chain(
    auth: AuthContext = Depends(require_roles(*STAFF_ROLES)),
    db: Session = Depends(get_db),
) -> AuditVerifyOut:
    valid, checked, invalid_id, message = verify_audit_chain(db)
    return AuditVerifyOut(
        valid=valid,
        checked_records=checked,
        first_invalid_id=invalid_id,
        message=message,
    )


@router.get("/export.csv")
def export_audit(
    q: str | None = Query(default=None, max_length=120),
    action: str | None = Query(default=None, max_length=80),
    actor_id: str | None = Query(default=None, max_length=36),
    target_type: str | None = Query(default=None, max_length=60),
    from_time: str | None = Query(default=None, max_length=40),
    to_time: str | None = Query(default=None, max_length=40),
    auth: AuthContext = Depends(require_roles(*STAFF_ROLES)),
    db: Session = Depends(get_db),
) -> Response:
    filters = _filters(
        q=q,
        action=action,
        actor_id=actor_id,
        target_type=target_type,
        from_time=from_time,
        to_time=to_time,
    )
    query = select(AuditLog)
    if filters:
        query = query.where(*filters)
    rows = list(db.scalars(query.order_by(AuditLog.sequence.asc()).limit(10000)))

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
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
    )
    for row in rows:
        writer.writerow(
            [
                row.sequence,
                _csv_safe(row.timestamp.isoformat() if row.timestamp else ""),
                _csv_safe(row.actor_label),
                _csv_safe(row.action),
                _csv_safe(row.target_type),
                _csv_safe(row.target_id),
                _csv_safe(row.result),
                _csv_safe(row.policy_version),
                _csv_safe(row.correlation_id),
                _csv_safe(row.prev_hash),
                _csv_safe(row.record_hash),
            ]
        )

    correlation_id = new_id()
    append_audit(
        db,
        actor=auth.identity,
        action="EXPORT_AUDIT_LOG",
        target_type="audit_log",
        target_id=None,
        correlation_id=correlation_id,
        result="SUCCESS",
        metadata={"row_count": len(rows), "filters": {"action": action, "q": bool(q)}},
    )
    db.commit()
    return Response(
        content=output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="aegis-audit-log.csv"',
            "X-Correlation-ID": correlation_id,
        },
    )
