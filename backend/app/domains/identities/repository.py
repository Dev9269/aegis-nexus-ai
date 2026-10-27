from __future__ import annotations

from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.pagination import page_offset
from app.db.models import (
    AccessRequest,
    AuditLog,
    BehavioralEvent,
    Device,
    Identity,
    SecurityEvent,
    UserSession,
)


def list_identity_rows(
    db: Session, *, filters: dict[str, Any], page: int, page_size: int
) -> tuple[list[Identity], int]:
    conditions: list[Any] = []
    q = filters.get("q")
    if q:
        pattern = f"%{q.strip()}%"
        conditions.append(
            or_(
                Identity.display_name.ilike(pattern),
                Identity.email.ilike(pattern),
                Identity.department.ilike(pattern),
                Identity.title.ilike(pattern),
            )
        )
    role = filters.get("role")
    if role:
        conditions.append(Identity.role == role)
    status = filters.get("status")
    if status:
        conditions.append(Identity.status == status)

    query = select(Identity)
    count_query = select(func.count(Identity.id))
    if conditions:
        query = query.where(*conditions)
        count_query = count_query.where(*conditions)
    total = int(db.scalar(count_query) or 0)
    rows = list(
        db.scalars(
            query.order_by(Identity.current_risk.desc(), Identity.display_name.asc())
            .offset(page_offset(page, page_size))
            .limit(page_size)
        )
    )
    return rows, total


def get_identity_row(db: Session, identity_id: str) -> Identity | None:
    return db.get(Identity, identity_id)


def list_sessions(db: Session, identity_id: str, *, limit: int = 10) -> list[UserSession]:
    return list(
        db.scalars(
            select(UserSession)
            .where(UserSession.identity_id == identity_id)
            .order_by(UserSession.created_at.desc())
            .limit(limit)
        )
    )


def list_devices(db: Session, identity_id: str) -> list[Device]:
    return list(
        db.scalars(
            select(Device)
            .where(Device.identity_id == identity_id)
            .order_by(Device.last_observed_at.desc().nullslast())
        )
    )


def list_recent_access(
    db: Session, identity_id: str, *, limit: int = 10
) -> list[AccessRequest]:
    return list(
        db.scalars(
            select(AccessRequest)
            .where(AccessRequest.identity_id == identity_id)
            .order_by(AccessRequest.created_at.desc())
            .limit(limit)
        )
    )


def list_behavior(
    db: Session, identity_id: str, *, limit: int = 30
) -> list[BehavioralEvent]:
    return list(
        db.scalars(
            select(BehavioralEvent)
            .where(BehavioralEvent.identity_id == identity_id)
            .order_by(BehavioralEvent.detected_at.desc())
            .limit(limit)
        )
    )


def list_alerts(
    db: Session, identity_id: str, *, limit: int = 10
) -> list[SecurityEvent]:
    return list(
        db.scalars(
            select(SecurityEvent)
            .where(
                SecurityEvent.identity_id == identity_id,
                SecurityEvent.severity.in_(["HIGH", "CRITICAL"]),
            )
            .order_by(SecurityEvent.timestamp.desc())
            .limit(limit)
        )
    )


def list_audits(db: Session, identity_id: str, *, limit: int = 10) -> list[AuditLog]:
    return list(
        db.scalars(
            select(AuditLog)
            .where(
                or_(
                    AuditLog.target_id == identity_id,
                    AuditLog.actor_id == identity_id,
                )
            )
            .order_by(AuditLog.sequence.desc())
            .limit(limit)
        )
    )
