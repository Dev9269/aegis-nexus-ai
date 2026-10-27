from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.api.schemas import Page
from app.core.errors import ApiError
from app.core.pagination import page_response
from app.db.models import Device, EnrollmentStatus, Identity, Severity, new_id, utcnow
from app.domains.audit.service import append_audit
from app.domains.devices import repository
from app.domains.devices.presenters import device_out
from app.domains.devices.schemas import DeviceEnrollIn, DeviceOut, DeviceStateIn
from app.domains.events.service import record_event


def list_devices(
    db: Session, *, filters: dict[str, Any], page: int, page_size: int
) -> Page[DeviceOut]:
    rows, total = repository.list_device_rows(
        db,
        filters=filters,
        page=page,
        page_size=page_size,
    )
    return page_response(
        [device_out(device) for device in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


def enroll_device(
    db: Session, *, payload: DeviceEnrollIn, actor: Identity
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
        actor_id=actor.id,
        details={"initial_state": device.state, "device_type": device.device_type},
        is_simulated=device.is_simulated,
    )
    append_audit(
        db,
        actor=actor,
        action="DEVICE_ENROLLED",
        target_type="device",
        target_id=device.id,
        correlation_id=correlation_id,
        metadata={"identity_id": identity.id, "initial_state": device.state},
    )
    db.commit()
    db.refresh(device)
    return device_out(device)


def update_device_state(
    db: Session,
    *,
    device_id: str,
    payload: DeviceStateIn,
    actor: Identity,
) -> DeviceOut:
    device = repository.get_device_row(db, device_id)
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
        actor_id=actor.id,
        details={"previous_state": previous, "new_state": payload.state, "reason": payload.reason},
        is_simulated=device.is_simulated,
    )
    append_audit(
        db,
        actor=actor,
        action=event_type,
        target_type="device",
        target_id=device.id,
        correlation_id=correlation_id,
        metadata={"previous_state": previous, "new_state": payload.state, "reason": payload.reason},
    )
    db.commit()
    db.refresh(device)
    return device_out(device)
