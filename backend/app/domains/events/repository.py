from __future__ import annotations

from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.pagination import page_offset
from app.core.time import parse_optional_utc
from app.db.models import SecurityEvent


def _build_conditions(filters: dict[str, Any]) -> list[Any]:
    conditions: list[Any] = []
    q = filters.get("q")
    if q:
        pattern = f"%{q.strip()}%"
        conditions.append(
            or_(
                SecurityEvent.summary.ilike(pattern),
                SecurityEvent.event_type.ilike(pattern),
                SecurityEvent.category.ilike(pattern),
            )
        )
    event_type = filters.get("event_type")
    if event_type:
        conditions.append(SecurityEvent.event_type == event_type)
    category = filters.get("category")
    if category:
        conditions.append(SecurityEvent.category == category)
    severity = filters.get("severity")
    if severity:
        conditions.append(SecurityEvent.severity == severity)
    identity_id = filters.get("identity_id")
    if identity_id:
        conditions.append(SecurityEvent.identity_id == identity_id)
    start = parse_optional_utc(filters.get("from_time"), "from_time")
    end = parse_optional_utc(filters.get("to_time"), "to_time")
    if start:
        conditions.append(SecurityEvent.timestamp >= start)
    if end:
        conditions.append(SecurityEvent.timestamp <= end)
    return conditions


def list_event_rows(
    db: Session, *, filters: dict[str, Any], page: int, page_size: int
) -> tuple[list[SecurityEvent], int]:
    conditions = _build_conditions(filters)
    query = select(SecurityEvent)
    count_query = select(func.count(SecurityEvent.id))
    if conditions:
        query = query.where(*conditions)
        count_query = count_query.where(*conditions)
    total = int(db.scalar(count_query) or 0)
    rows = list(
        db.scalars(
            query.order_by(SecurityEvent.timestamp.desc())
            .offset(page_offset(page, page_size))
            .limit(page_size)
        )
    )
    return rows, total


def get_event_row(db: Session, event_id: str) -> SecurityEvent | None:
    return db.get(SecurityEvent, event_id)


def list_notification_rows(db: Session, *, limit: int = 8) -> list[SecurityEvent]:
    return list(
        db.scalars(
            select(SecurityEvent)
            .where(SecurityEvent.severity.in_(["HIGH", "CRITICAL"]))
            .order_by(SecurityEvent.timestamp.desc())
            .limit(limit)
        )
    )
