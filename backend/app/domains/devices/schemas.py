from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class DeviceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    identity_id: str
    identity_name: str | None = None
    name: str
    device_type: str
    operating_system: str
    state: str
    enrollment_status: str
    last_observed_at: datetime | None
    enrolled_at: datetime
    revoked_at: datetime | None
    signals: dict[str, Any]
    is_simulated: bool


class DeviceEnrollIn(BaseModel):
    identity_id: str
    name: str = Field(min_length=2, max_length=120)
    device_type: Literal["Laptop", "Desktop", "Mobile", "Tablet", "Virtual Machine"]
    operating_system: str = Field(min_length=2, max_length=80)
    initial_state: Literal["TRUSTED", "UNVERIFIED"] = "UNVERIFIED"


class DeviceStateIn(BaseModel):
    state: Literal["TRUSTED", "UNVERIFIED", "RESTRICTED", "REVOKED"]
    reason: str = Field(min_length=3, max_length=500)
