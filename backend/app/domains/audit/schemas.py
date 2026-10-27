from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class AuditOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    sequence: int
    timestamp: datetime
    actor_id: str | None
    actor_label: str
    action: str
    target_type: str
    target_id: str | None
    result: str
    policy_version: str | None
    correlation_id: str
    metadata_json: dict[str, Any]
    prev_hash: str
    record_hash: str


class AuditVerifyOut(BaseModel):
    valid: bool
    checked_records: int
    first_invalid_id: str | None = None
    message: str
