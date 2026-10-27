from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import AuthContext, require_roles
from app.core.database import get_db
from app.core.roles import ADMIN_ROLES, STAFF_ROLES, WRITE_ROLES
from app.domains.policies.schemas import (
    PolicyOut,
    PolicyPreviewIn,
    PolicyPreviewOut,
    PolicyUpdateIn,
    ResourcePolicyOut,
)
from app.domains.policies.service import (
    get_policy_history as get_policy_history_service,
    get_resource as get_resource_service,
    list_resources as list_resources_service,
    preview_policy as preview_policy_service,
    update_policy as update_policy_service,
)

router = APIRouter(tags=["policies"])


@router.get("/resources", response_model=list[ResourcePolicyOut])
def list_resources(
    q: str | None = Query(default=None, max_length=120),
    sensitivity: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"] | None = Query(default=None),
    auth: AuthContext = Depends(require_roles(*STAFF_ROLES)),
    db: Session = Depends(get_db),
) -> list[ResourcePolicyOut]:
    return list_resources_service(db, q=q, sensitivity=sensitivity)


@router.get("/resources/{resource_id}", response_model=ResourcePolicyOut)
def get_resource(
    resource_id: str,
    auth: AuthContext = Depends(require_roles(*STAFF_ROLES)),
    db: Session = Depends(get_db),
) -> ResourcePolicyOut:
    return get_resource_service(db, resource_id)


@router.get("/resources/{resource_id}/policies", response_model=list[PolicyOut])
def get_policy_history(
    resource_id: str,
    auth: AuthContext = Depends(require_roles(*STAFF_ROLES)),
    db: Session = Depends(get_db),
) -> list[PolicyOut]:
    return get_policy_history_service(db, resource_id)


@router.put("/resources/{resource_id}/policy", response_model=PolicyOut)
def update_policy(
    resource_id: str,
    payload: PolicyUpdateIn,
    auth: AuthContext = Depends(require_roles(*ADMIN_ROLES)),
    db: Session = Depends(get_db),
) -> PolicyOut:
    return update_policy_service(db, resource_id=resource_id, payload=payload, actor=auth.identity)


@router.post("/policies/preview", response_model=PolicyPreviewOut)
def preview_policy(
    payload: PolicyPreviewIn,
    auth: AuthContext = Depends(require_roles(*WRITE_ROLES)),
) -> PolicyPreviewOut:
    return preview_policy_service(payload)
