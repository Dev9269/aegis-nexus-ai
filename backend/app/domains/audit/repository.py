from __future__ import annotations

from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.pagination import page_offset
from app.db.models import AuditLog


def list_audit_rows(
    db: Session, filters: list[Any], *, page: int, page_size: int
) -> tuple[list[AuditLog], int]:
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
    return rows, total


def list_audit_export_rows(
    db: Session, filters: list[Any], *, limit: int = 10000
) -> list[AuditLog]:
    query = select(AuditLog)
    if filters:
        query = query.where(*filters)
    return list(db.scalars(query.order_by(AuditLog.sequence.asc()).limit(limit)))
