from __future__ import annotations

from pydantic import BaseModel


class ComplianceControl(BaseModel):
    control_id: str
    name: str
    status: str
    evidence: str
    last_verified: str | None = None


class ComplianceReport(BaseModel):
    framework: str
    generated_at: str
    overall_status: str
    controls: list[ComplianceControl]
    summary: dict
