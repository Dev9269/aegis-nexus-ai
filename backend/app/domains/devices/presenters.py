from __future__ import annotations

from app.db.models import Device
from app.domains.devices.schemas import DeviceOut


def device_out(device: Device) -> DeviceOut:
    return DeviceOut(
        id=device.id,
        identity_id=device.identity_id,
        identity_name=device.identity.display_name if device.identity else None,
        name=device.name,
        device_type=device.device_type,
        operating_system=device.operating_system,
        state=device.state,
        enrollment_status=device.enrollment_status,
        last_observed_at=device.last_observed_at,
        enrolled_at=device.enrolled_at,
        revoked_at=device.revoked_at,
        signals=device.signals or {},
        is_simulated=device.is_simulated,
    )
