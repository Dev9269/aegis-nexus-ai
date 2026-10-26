from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import AuthContext, require_roles
from app.audit.service import append_audit
from app.core.database import get_db
from app.core.errors import ApiError
from app.models import Device, EnrollmentStatus, Identity, Severity, new_id, utcnow
from app.schemas import DeviceEnrollIn, DeviceOut, DeviceStateIn, Page
from app.serializers import device_out
from app.services.events import record_event

router = APIRouter(prefix="/devices", tags=["devices"])
Staff = Depends(require_roles("SECURITY_ADMIN", "SECURITY_ANALYST", "AUDITOR"))
Admin = Depends(require_roles("SECURITY_ADMIN"))


@router.get("", response_model=Page[DeviceOut])
def list_devices(
    q: str | None = Query(default=None, max_length=120),
    state: Literal["TRUSTED", "UNVERIFIED", "RESTRICTED", "REVOKED"] | None = None,
    identity_id: str | None = Query(default=None, max_length=36),
    page: int = Query(default=1, ge=1, le=10000),
    page_size: int = Query(default=20, ge=1, le=100),
    auth: AuthContext = Depends(require_roles("SECURITY_ADMIN", "SECURITY_ANALYST", "AUDITOR")),
    db: Session = Depends(get_db),
) -> Page[DeviceOut]:
    query = select(Device)
    count_query = select(func.count(Device.id))
    filters = []
    if q:
        pattern = f"%{q.strip()}%"
        filters.append(
            or_(
                Device.name.ilike(pattern),
                Device.operating_system.ilike(pattern),
                Device.device_type.ilike(pattern),
            )
        )
    if state:
        filters.append(Device.state == state)
    if identity_id:
        filters.append(Device.identity_id == identity_id)
    if filters:
        query = query.where(*filters)
        count_query = count_query.where(*filters)
    total = int(db.scalar(count_query) or 0)
    devices = list(
        db.scalars(
            query.order_by(Device.enrolled_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    )
    return Page(
        items=[device_out(device) for device in devices],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=DeviceOut, status_code=201)
def enroll_device(
    payload: DeviceEnrollIn,
    auth: AuthContext = Depends(require_roles("SECURITY_ADMIN")),
    db: Session = Depends(get_db),
) -> DeviceOut:
    identity = db.get(Identity, payload.identity_id)
    if identity is None:
        raise ApiError(404, "IDENTITY_NOT_FOUND", "Identity not found for device enrollment.")
    if identity.status != "ACTIVE":
        raise ApiError(409, "IDENTITY_INACTIVE", "Devices cannot be enrolled for an inactive identity.")

    device = Device(
        identity_id=identity.id,
        name=payload.name.strip(),
        device_type=payload.device_type,
        operating_system=payload.operating_system.strip(),
        state=payload.initial_state,
        enrollment_status=EnrollmentStatus.ENROLLED.value,
        last_observed_at=utcnow(),
        signals={
            "simulated_attributes": True,
            "attestation": "not_performed",
            "note": "Prototype device trust uses declared attributes, not hardware attestation.",
        },
        is_simulated=identity.is_simulated,
    )
    db.add(device)
    db.flush()
    correlation_id = new_id()
    record_event(
        db,
        event_type="DEVICE_ENROLLED",
        category="Device",
        summary=f"{device.name} enrolled for {identity.display_name}",
        correlation_id=correlation_id,
        severity=Severity.LOW.value,
        identity_id=identity.id,
        device_id=device.id,
        actor_id=auth.identity.id,
        details={"initial_state": device.state, "device_type": device.device_type},
        is_simulated=device.is_simulated,
    )
    append_audit(
        db,
        actor=auth.identity,
        action="DEVICE_ENROLLED",
        target_type="device",
        target_id=device.id,
        correlation_id=correlation_id,
        metadata={"identity_id": identity.id, "initial_state": device.state},
    )
    db.commit()
    db.refresh(device)
    return device_out(device)


@router.patch("/{device_id}/state", response_model=DeviceOut)
def update_device_state(
    device_id: str,
    payload: DeviceStateIn,
    auth: AuthContext = Depends(require_roles("SECURITY_ADMIN")),
    db: Session = Depends(get_db),
) -> DeviceOut:
    device = db.get(Device, device_id)
    if device is None:
        raise ApiError(404, "DEVICE_NOT_FOUND", "Device not found.")
    if device.state == payload.state:
        raise ApiError(409, "NO_STATE_CHANGE", "The device already has that trust state.")
    if device.state == "REVOKED":
        raise ApiError(
            409,
            "DEVICE_REVOKED",
            "A revoked device cannot change state. Enroll a new device instead.",
        )
    if device.state == "TRUSTED" and payload.state == "UNVERIFIED":
        raise ApiError(
            409,
            "INVALID_TRUST_TRANSITION",
            "A trusted device cannot be downgraded to unverified; restrict or revoke it instead.",
        )

    previous = device.state
    device.state = payload.state
    device.last_observed_at = utcnow()
    if payload.state == "REVOKED":
        device.revoked_at = utcnow()
        device.enrollment_status = EnrollmentStatus.REVOKED.value
    correlation_id = new_id()
    event_type = "DEVICE_REVOKED" if payload.state == "REVOKED" else "DEVICE_STATE_CHANGED"
    severity = Severity.HIGH.value if payload.state in {"REVOKED", "RESTRICTED"} else Severity.LOW.value
    record_event(
        db,
        event_type=event_type,
        category="Device",
        summary=f"{device.name} changed from {previous} to {payload.state}",
        correlation_id=correlation_id,
        severity=severity,
        identity_id=device.identity_id,
        device_id=device.id,
        actor_id=auth.identity.id,
        details={"previous_state": previous, "new_state": payload.state, "reason": payload.reason},
        is_simulated=device.is_simulated,
    )
    append_audit(
        db,
        actor=auth.identity,
        action=event_type,
        target_type="device",
        target_id=device.id,
        correlation_id=correlation_id,
        metadata={"previous_state": previous, "new_state": payload.state, "reason": payload.reason},
    )
    db.commit()
    db.refresh(device)
    return device_out(device)
