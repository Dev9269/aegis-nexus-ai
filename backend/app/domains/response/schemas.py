from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

PlaybookActionId = Literal[
    "DISABLE_IDENTITY",
    "REVOKE_SESSIONS",
    "ROTATE_CREDENTIALS",
    "RESTRICT_DEVICES",
    "CONTAIN_INCIDENT",
]


class PlaybookActionInfo(BaseModel):
    id: PlaybookActionId
    label: str
    description: str
    severity: str
    reversible: bool


class PlaybookCatalog(BaseModel):
    actions: list[PlaybookActionInfo]
    note: str


class PlaybookRequest(BaseModel):
    actions: list[PlaybookActionId] = Field(min_length=1, max_length=5)
    reason: str = Field(min_length=3, max_length=400)


class PlaybookActionOutcome(BaseModel):
    action: PlaybookActionId
    label: str
    status: Literal["APPLIED", "SKIPPED", "FAILED"]
    detail: str


class PlaybookResult(BaseModel):
    incident_id: str
    incident_status: str
    identity_id: str | None
    identity_status: str | None
    outcomes: list[PlaybookActionOutcome]
    applied_count: int
    correlation_id: str
    summary: str
