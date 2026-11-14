from __future__ import annotations

from pydantic import BaseModel


class ReportMetric(BaseModel):
    label: str
    value: str


class ReportSection(BaseModel):
    title: str
    metrics: list[ReportMetric]
    bullets: list[str] = []


class ExecutiveReport(BaseModel):
    generated_at: str
    organization: str
    headline: str
    overall_risk: str
    highlights: list[str]
    sections: list[ReportSection]
