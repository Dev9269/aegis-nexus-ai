from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.api.deps import AuthContext, get_auth_context, require_roles
from app.api.schemas import Page
from app.core.csv import csv_download
from app.core.database import get_db
from app.core.roles import STAFF_ROLES
from app.domains.access.schemas import (
    AccessRequestDetail,
    AccessRequestOut,
    DecisionOut,
    EvaluateAccessIn,
)
from app.domains.access.service import (
    evaluate_access_request as evaluate_access_request_service,
    export_access_requests as export_access_requests_service,
    get_access_request as get_access_request_service,
    list_access_requests as list_access_requests_service,
)

router = APIRouter(prefix="/access-requests", tags=["access"])


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
    return list_access_requests_service(
        db,
        auth=auth,
        filters={
            "q": q,
            "decision": decision,
            "risk_category": risk_category,
            "identity_id": identity_id,
            "from_time": from_time,
            "to_time": to_time,
        },
        page=page,
        page_size=page_size,
    )


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
    export = export_access_requests_service(
        db,
        auth=auth,
        filters={
            "q": q,
            "decision": decision,
            "risk_category": risk_category,
            "identity_id": identity_id,
            "from_time": from_time,
            "to_time": to_time,
        },
    )
    return csv_download(
        headers=export.headers,
        rows=export.rows,
        filename=export.filename,
        correlation_id=export.correlation_id,
    )


@router.post("/evaluate", response_model=DecisionOut)
def evaluate_access_request(
    payload: EvaluateAccessIn,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> DecisionOut:
    return evaluate_access_request_service(db, payload=payload, auth=auth)


@router.get("/{request_id}", response_model=AccessRequestDetail)
def get_access_request(
    request_id: str,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> AccessRequestDetail:
    return get_access_request_service(db, request_id=request_id, auth=auth)
