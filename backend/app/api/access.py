from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import AuthContext, get_auth_context, require_roles
from app.api.schemas import Page
from app.audit.service import append_audit
from app.core.csv import csv_download
from app.core.database import get_db
from app.core.errors import ApiError
from app.core.pagination import page_offset, page_response
from app.core.roles import STAFF_ROLES, WRITE_ROLES
from app.core.time import parse_optional_utc
from app.models import AccessRequest, Device, Identity, Resource, new_id
from app.schemas import (
    AccessRequestDetail,
    AccessRequestOut,
    DecisionOut,
    EvaluateAccessIn,
)
from app.serializers import access_detail, access_out
from app.services.access import evaluate_access

router = APIRouter(prefix="/access-requests", tags=["access"])


def _scoped_request_query(
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
) -> list:
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


@router.get("", response_model=Page[AccessRequestOut])
def list_access_requests(
    q: str | None = Query(default=None, max_length=120),
    decision: Literal["ALLOW", "DENY", "CHALLENGE", "RESTRICT"] | None = Query(default=None),
    risk_category: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"] | None = Query(default=None),
    identity_id: str | None = Query(default=None, max_length=36),
    from_time: str | None = Query(default=None, max_length=40),
    to_time: str | None = Query(default=None, max_length=40),
    page: int = Query(default=1, ge=1, le=10000),
    page_size: int = Query(default=20, ge=1, le=100),
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> Page[AccessRequestOut]:
    query, count_query, filters = _scoped_request_query(auth, identity_id=identity_id)
    filters += _list_filters(
        q=q,
        decision=decision,
        risk_category=risk_category,
        from_time=from_time,
        to_time=to_time,
    )
    if filters:
        query = query.where(*filters)
        count_query = count_query.where(*filters)
    total = int(db.scalar(count_query) or 0)
    rows = list(
        db.scalars(
            query.order_by(AccessRequest.created_at.desc())
            .offset(page_offset(page, page_size))
            .limit(page_size)
        )
    )
    return page_response([access_out(row) for row in rows], total=total, page=page, page_size=page_size)


@router.get("/export.csv")
def export_access_requests(
    q: str | None = Query(default=None, max_length=120),
    decision: Literal["ALLOW", "DENY", "CHALLENGE", "RESTRICT"] | None = Query(default=None),
    risk_category: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"] | None = Query(default=None),
    identity_id: str | None = Query(default=None, max_length=36),
    from_time: str | None = Query(default=None, max_length=40),
    to_time: str | None = Query(default=None, max_length=40),
    auth: AuthContext = Depends(require_roles(*STAFF_ROLES)),
    db: Session = Depends(get_db),
) -> Response:
    query, _, filters = _scoped_request_query(auth, identity_id=identity_id)
    filters += _list_filters(
        q=q,
        decision=decision,
        risk_category=risk_category,
        from_time=from_time,
        to_time=to_time,
    )
    if filters:
        query = query.where(*filters)
    rows = list(db.scalars(query.order_by(AccessRequest.created_at.desc()).limit(5000)))
    csv_rows = [
        [
            row.id,
            row.created_at.isoformat() if row.created_at else "",
            row.identity.display_name if row.identity else "",
            row.identity.email if row.identity else "",
            row.resource.name if row.resource else "",
            row.resource.key if row.resource else "",
            row.requested_action,
            row.device_id or "",
            row.risk_score,
            row.risk_category,
            row.decision,
            row.policy_version,
            ",".join(reason.get("code", "") for reason in row.reasons or []),
            row.is_simulated,
        ]
        for row in rows
    ]

    correlation_id = new_id()
    append_audit(
        db,
        actor=auth.identity,
        action="EXPORT_ACCESS_REQUESTS",
        target_type="access_requests",
        target_id=None,
        correlation_id=correlation_id,
        result="SUCCESS",
        metadata={"row_count": len(rows), "filters": {"decision": decision, "q": bool(q)}},
    )
    db.commit()
    return csv_download(
        headers=[
            "request_id",
            "timestamp",
            "identity",
            "identity_email",
            "resource",
            "resource_key",
            "action",
            "device_id",
            "risk_score",
            "risk_category",
            "decision",
            "policy_version",
            "reason_codes",
            "simulated",
        ],
        rows=csv_rows,
        filename="aegis-access-requests.csv",
        correlation_id=correlation_id,
    )


@router.post("/evaluate", response_model=DecisionOut)
def evaluate_access_request(
    payload: EvaluateAccessIn,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> DecisionOut:
    if auth.identity.role == "AUDITOR":
        raise ApiError(403, "FORBIDDEN", "Auditors have read-only access.")
    is_staff = auth.identity.role in WRITE_ROLES
    subject_id = payload.identity_id or auth.identity.id
    if not is_staff and subject_id != auth.identity.id:
        raise ApiError(403, "FORBIDDEN", "You may only request access for your own identity.")
    if payload.simulate and not is_staff:
        raise ApiError(403, "FORBIDDEN", "Only security staff may run simulated access decisions.")

    subject = db.get(Identity, subject_id)
    if subject is None:
        raise ApiError(404, "IDENTITY_NOT_FOUND", "Identity not found.")
    resource = db.get(Resource, payload.resource_id)
    if resource is None:
        raise ApiError(404, "RESOURCE_NOT_FOUND", "Resource not found.")
    device = None
    if payload.device_id:
        device = db.get(Device, payload.device_id)
        if device is None:
            raise ApiError(404, "DEVICE_NOT_FOUND", "Device not found.")

    try:
        outcome = evaluate_access(
            db,
            subject=subject,
            resource=resource,
            device=device,
            requested_action=payload.requested_action,
            features=payload.features.model_dump(),
            actor=auth.identity,
            simulate=payload.simulate,
        )
    except FileNotFoundError as exc:
        raise ApiError(
            503,
            "MODEL_UNAVAILABLE",
            "The anomaly detection model is unavailable. Train the model before evaluating access.",
        ) from exc
    db.commit()

    request_row = outcome.access_request
    return DecisionOut(
        request_id=request_row.id,
        identity_id=request_row.identity_id,
        resource_id=request_row.resource_id,
        requested_action=request_row.requested_action,
        decision=request_row.decision,
        risk_category=request_row.risk_category,
        risk_score=request_row.risk_score,
        anomaly_score=request_row.anomaly_score,
        policy_version=request_row.policy_version,
        reasons=request_row.reasons or [],
        recommended_next_step=request_row.recommended_action,
        timestamp=request_row.created_at,
        correlation_id=request_row.correlation_id,
        is_simulated=request_row.is_simulated,
    )


@router.get("/{request_id}", response_model=AccessRequestDetail)
def get_access_request(
    request_id: str,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> AccessRequestDetail:
    row = db.get(AccessRequest, request_id)
    if row is None:
        raise ApiError(404, "ACCESS_REQUEST_NOT_FOUND", "Access request not found.")
    is_staff = auth.identity.role in STAFF_ROLES
    if not is_staff and row.identity_id != auth.identity.id:
        raise ApiError(403, "FORBIDDEN", "You may only view your own access requests.")
    return access_detail(row)
