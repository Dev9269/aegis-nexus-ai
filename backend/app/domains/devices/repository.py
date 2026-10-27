from __future__ import annotations

from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.pagination import page_offset
from app.db.models import Device


def list_device_rows(
    db: Session, *, filters: dict[str, Any], page: int, page_size: int
) -> tuple[list[Device], int]:
    conditions: list[Any] = []
    q = filters.get("q")
    if q:
        pattern = f"%{q.strip()}%"
        conditions.append(
            or_(
                Device.name.ilike(pattern),
                Device.operating_system.ilike(pattern),
                Device.device_type.ilike(pattern),
            )
        )
    state = filters.get("state")
    if state:
        conditions.append(Device.state == state)
    identity_id = filters.get("identity_id")
    if identity_id:
        conditions.append(Device.identity_id == identity_id)

    query = select(Device)
    count_query = select(func.count(Device.id))
    if conditions:
        query = query.where(*conditions)
        count_query = count_query.where(*conditions)
    total = int(db.scalar(count_query) or 0)
    rows = list(
        db.scalars(
            query.order_by(Device.enrolled_at.desc())
            .offset(page_offset(page, page_size))
            .limit(page_size)
        )
    )
    return rows, total


def get_device_row(db: Session, device_id: str) -> Device | None:
    return db.get(Device, device_id)
