from __future__ import annotations

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.db.models import AccessPolicy, Resource


def active_policy(db: Session, resource_id: str) -> AccessPolicy | None:
    return db.scalar(
        select(AccessPolicy)
        .where(AccessPolicy.resource_id == resource_id, AccessPolicy.is_active.is_(True))
        .order_by(AccessPolicy.version.desc())
        .limit(1)
    )


def policy_version_count(db: Session, resource_id: str) -> int:
    return int(
        db.scalar(
            select(func.count(AccessPolicy.id)).where(AccessPolicy.resource_id == resource_id)
        )
        or 0
    )


def list_resource_rows(
    db: Session, *, q: str | None, sensitivity: str | None
) -> list[Resource]:
    query = select(Resource)
    if q:
        pattern = f"%{q.strip()}%"
        query = query.where(
            or_(
                Resource.name.ilike(pattern),
                Resource.key.ilike(pattern),
                Resource.owner_department.ilike(pattern),
            )
        )
    if sensitivity:
        query = query.where(Resource.sensitivity == sensitivity)
    return list(db.scalars(query.order_by(Resource.name.asc())))


def get_resource_row(db: Session, resource_id: str) -> Resource | None:
    return db.get(Resource, resource_id)


def list_policy_rows(db: Session, resource_id: str) -> list[AccessPolicy]:
    return list(
        db.scalars(
            select(AccessPolicy)
            .where(AccessPolicy.resource_id == resource_id)
            .order_by(AccessPolicy.version.desc())
        )
    )
