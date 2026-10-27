from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import AuthContext, require_roles
from app.api.schemas import Page
from app.core.database import get_db
from app.core.roles import ADMIN_ROLES, STAFF_ROLES
from app.domains.devices.schemas import DeviceEnrollIn, DeviceOut, DeviceStateIn
from app.domains.devices.service import (
    enroll_device as enroll_device_service,
    list_devices as list_devices_service,
    update_device_state as update_device_state_service,
)

router = APIRouter(prefix="/devices", tags=["devices"])


@router.get("", response_model=Page[DeviceOut])
def list_devices(
    q: str | None = Query(default=None, max_length=120),
    state: Literal["TRUSTED", "UNVERIFIED", "RESTRICTED", "REVOKED"] | None = None,
    identity_id: str | None = Query(default=None, max_length=36),
    page: int = Query(default=1, ge=1, le=10000),
    page_size: int = Query(default=20, ge=1, le=100),
    auth: AuthContext = Depends(require_roles(*STAFF_ROLES)),
    db: Session = Depends(get_db),
) -> Page[DeviceOut]:
    return list_devices_service(
        db,
        filters={"q": q, "state": state, "identity_id": identity_id},
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=DeviceOut, status_code=201)
def enroll_device(
    payload: DeviceEnrollIn,
    auth: AuthContext = Depends(require_roles(*ADMIN_ROLES)),
    db: Session = Depends(get_db),
) -> DeviceOut:
    return enroll_device_service(db, payload=payload, actor=auth.identity)


@router.patch("/{device_id}/state", response_model=DeviceOut)
def update_device_state(
    device_id: str,
    payload: DeviceStateIn,
    auth: AuthContext = Depends(require_roles(*ADMIN_ROLES)),
    db: Session = Depends(get_db),
) -> DeviceOut:
    return update_device_state_service(
        db,
        device_id=device_id,
        payload=payload,
        actor=auth.identity,
    )
