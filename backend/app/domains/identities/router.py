from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import AuthContext, get_auth_context, require_roles
from app.api.schemas import Page
from app.core.database import get_db
from app.core.roles import STAFF_ROLES
from app.domains.identities.schemas import IdentityDetail, IdentitySummary
from app.domains.identities.service import (
    get_identity as get_identity_service,
    list_identities as list_identities_service,
)

router = APIRouter(prefix="/identities", tags=["identities"])
Staff = Literal["SECURITY_ADMIN", "SECURITY_ANALYST", "AUDITOR"]


@router.get("", response_model=Page[IdentitySummary])
def list_identities(
    q: str | None = Query(default=None, max_length=120),
    role: Staff | str | None = Query(default=None),
    status: Literal["ACTIVE", "DISABLED"] | None = Query(default=None),
    page: int = Query(default=1, ge=1, le=10000),
    page_size: int = Query(default=20, ge=1, le=100),
    auth: AuthContext = Depends(require_roles(*STAFF_ROLES)),
    db: Session = Depends(get_db),
) -> Page[IdentitySummary]:
    return list_identities_service(
        db,
        filters={"q": q, "role": role, "status": status},
        page=page,
        page_size=page_size,
    )


@router.get("/{identity_id}", response_model=IdentityDetail)
def get_identity(
    identity_id: str,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> IdentityDetail:
    return get_identity_service(db, identity_id=identity_id, auth=auth)
