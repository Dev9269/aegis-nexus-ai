from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class ResourceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    key: str
    name: str
    description: str
    sensitivity: str
    owner_department: str
    is_active: bool
    is_simulated: bool


class PolicyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    resource_id: str
    version: int
    allowed_roles: list[str]
    allowed_device_states: list[str]
    challenge_threshold: int
    deny_threshold: int
    require_additional_verification: bool
    session_max_minutes: int
    is_active: bool
    created_by: str | None
    created_at: datetime
    change_reason: str
    is_simulated: bool


class ResourcePolicyOut(ResourceOut):
    policy: PolicyOut | None
    version_count: int


class PolicyUpdateIn(BaseModel):
    allowed_roles: list[str] = Field(min_length=1)
    allowed_device_states: list[str] = Field(min_length=1)
    challenge_threshold: int = Field(ge=0, le=100)
    deny_threshold: int = Field(ge=0, le=100)
    require_additional_verification: bool = True
    session_max_minutes: int = Field(ge=5, le=480)
    reason: str = Field(min_length=5, max_length=1000)
    is_active: bool = True

    @field_validator("allowed_roles")
    @classmethod
    def valid_roles(cls, values: list[str]) -> list[str]:
        allowed = {"SECURITY_ADMIN", "SECURITY_ANALYST", "EMPLOYEE", "AUDITOR"}
        unknown = set(values) - allowed
        if unknown:
            raise ValueError(f"unknown roles: {sorted(unknown)}")
        return sorted(set(values))

    @field_validator("allowed_device_states")
    @classmethod
    def valid_states(cls, values: list[str]) -> list[str]:
        allowed = {"TRUSTED", "UNVERIFIED", "RESTRICTED"}
        unknown = set(values) - allowed
        if unknown:
            raise ValueError(f"unknown device states: {sorted(unknown)}")
        return sorted(set(values))

    @model_validator(mode="after")
    def thresholds_are_ordered(self):
        if self.challenge_threshold >= self.deny_threshold:
            raise ValueError("challenge_threshold must be lower than deny_threshold")
        return self


class PolicyPreviewCase(BaseModel):
    role: Literal["SECURITY_ADMIN", "SECURITY_ANALYST", "EMPLOYEE", "AUDITOR"]
    device_state: Literal["TRUSTED", "UNVERIFIED", "RESTRICTED", "REVOKED"]
    risk_score: float = Field(ge=0, le=100)
    account_active: bool = True
    identity_authorized: bool = True
    session_active: bool = True
    repeated_anomalies: int = Field(default=0, ge=0, le=20)


class PolicyPreviewIn(BaseModel):
    draft: PolicyUpdateIn
    cases: list[PolicyPreviewCase] = Field(min_length=1, max_length=50)


class PolicyPreviewResult(BaseModel):
    case_index: int
    decision: str
    reasons: list[dict[str, Any]]


class PolicyPreviewOut(BaseModel):
    policy_version_preview: str
    results: list[PolicyPreviewResult]
    persisted: Literal[False] = False
