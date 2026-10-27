from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import AuthContext, require_roles
from app.api.schemas import Page
from app.audit.service import append_audit, verify_audit_chain
from app.core.csv import csv_download
from app.core.database import get_db
from app.core.pagination import page_offset, page_response
from app.core.roles import STAFF_ROLES
from app.core.time import parse_optional_utc
from app.models import AuditLog, new_id
from app.schemas import AuditOut, AuditVerifyOut

router = APIRouter(prefix="/audit", tags=["audit"])


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
    start = parse_optional_utc(from_time, "from_time")
    end = parse_optional_utc(to_time, "to_time")
    if start:
        filters.append(AuditLog.timestamp >= start)
    if end:
        filters.append(AuditLog.timestamp <= end)
    return filters


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
            .offset(page_offset(page, page_size))
            .limit(page_size)
        )
    )
    return page_response(
        [AuditOut.model_validate(row) for row in rows],
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
        actor=auth.identity,
        action="EXPORT_AUDIT_LOG",
        target_type="audit_log",
        target_id=None,
        correlation_id=correlation_id,
        result="SUCCESS",
        metadata={"row_count": len(rows), "filters": {"action": action, "q": bool(q)}},
    )
    db.commit()
    return csv_download(
        headers=[
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
        ],
        rows=csv_rows,
        filename="aegis-audit-log.csv",
        correlation_id=correlation_id,
    )
