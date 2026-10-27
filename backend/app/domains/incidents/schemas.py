from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.domains.access.schemas import AccessRequestOut
from app.domains.events.schemas import SecurityEventOut


class IncidentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    classification: str
    severity: str
    status: str
    identity_id: str | None
    identity_name: str | None = None
    summary: str
    assigned_to: str | None
    related_access_request_ids: list[str]
    related_device_ids: list[str]
    resolution: str | None
    created_at: datetime
    updated_at: datetime
    is_simulated: bool


class IncidentNoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    author_label: str
    note: str
    created_at: datetime


class IncidentDetail(IncidentOut):
    notes: list[IncidentNoteOut]
    timeline: list[SecurityEventOut]
    access_requests: list[AccessRequestOut]


class IncidentUpdateIn(BaseModel):
    status: Literal[
        "OPEN", "INVESTIGATING", "CONTAINED", "RESOLVED", "FALSE_POSITIVE"
    ] | None = None
    severity: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"] | None = None
    assigned_to: str | None = None
    resolution: str | None = Field(default=None, max_length=2000)
    note: str | None = Field(default=None, max_length=2000)


class IncidentNoteIn(BaseModel):
    note: str = Field(min_length=1, max_length=2000)
