from __future__ import annotations

from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import AuthContext
from app.core.errors import ApiError
from app.core.pagination import page_offset
from app.core.roles import STAFF_ROLES
from app.core.time import parse_optional_utc
from app.db.models import AccessRequest, Device, Identity, Resource


def scoped_request_query(
    auth: AuthContext,
    *,
    identity_id: str | None = None,
):
    query = (
        select(AccessRequest)
        .join(Identity, AccessRequest.identity_id == Identity.id)
        .join(Resource, AccessRequest.resource_id == Resource.id)
    )
    count_query = (
        select(func.count(AccessRequest.id))
        .join(Identity, AccessRequest.identity_id == Identity.id)
        .join(Resource, AccessRequest.resource_id == Resource.id)
    )
    filters = []
    if auth.identity.role in STAFF_ROLES:
        if identity_id:
            filters.append(AccessRequest.identity_id == identity_id)
    else:
        if identity_id and identity_id != auth.identity.id:
            raise ApiError(403, "FORBIDDEN", "You may only view your own access requests.")
        filters.append(AccessRequest.identity_id == auth.identity.id)
    return query, count_query, filters


def _list_filters(
    *,
    q: str | None,
    decision: str | None,
    risk_category: str | None,
    from_time: str | None,
    to_time: str | None,
) -> list[Any]:
    filters = []
    if q:
        pattern = f"%{q.strip()}%"
        filters.append(
            or_(
                Identity.display_name.ilike(pattern),
                Identity.email.ilike(pattern),
                Resource.name.ilike(pattern),
                Resource.key.ilike(pattern),
                AccessRequest.id.ilike(pattern),
            )
        )
    if decision:
        filters.append(AccessRequest.decision == decision)
    if risk_category:
        filters.append(AccessRequest.risk_category == risk_category)
    start = parse_optional_utc(from_time, "from_time")
    end = parse_optional_utc(to_time, "to_time")
    if start:
        filters.append(AccessRequest.created_at >= start)
    if end:
        filters.append(AccessRequest.created_at <= end)
    return filters


def _request_query(
    auth: AuthContext,
    *,
    filters: dict[str, Any],
):
    query, count_query, scoped_filters = scoped_request_query(
        auth, identity_id=filters.get("identity_id")
    )
    conditions = scoped_filters + _list_filters(
        q=filters.get("q"),
        decision=filters.get("decision"),
        risk_category=filters.get("risk_category"),
        from_time=filters.get("from_time"),
        to_time=filters.get("to_time"),
    )
    if conditions:
        query = query.where(*conditions)
        count_query = count_query.where(*conditions)
    return query.order_by(AccessRequest.created_at.desc()), count_query


def list_access_rows(
    db: Session,
    *,
    auth: AuthContext,
    filters: dict[str, Any],
    page: int,
    page_size: int,
) -> tuple[list[AccessRequest], int]:
    query, count_query = _request_query(auth, filters=filters)
    total = int(db.scalar(count_query) or 0)
    rows = list(
        db.scalars(
            query.offset(page_offset(page, page_size)).limit(page_size)
        )
    )
    return rows, total


def list_access_export_rows(
    db: Session,
    *,
    auth: AuthContext,
    filters: dict[str, Any],
    limit: int = 5000,
) -> list[AccessRequest]:
    query, _ = _request_query(auth, filters=filters)
    return list(db.scalars(query.limit(limit)))


def get_access_row(db: Session, request_id: str) -> AccessRequest | None:
    return db.get(AccessRequest, request_id)


def get_identity(db: Session, identity_id: str) -> Identity | None:
    return db.get(Identity, identity_id)


def get_resource(db: Session, resource_id: str) -> Resource | None:
    return db.get(Resource, resource_id)


def get_device(db: Session, device_id: str) -> Device | None:
    return db.get(Device, device_id)
