from __future__ import annotations

from pydantic import BaseModel, Field


class CopilotQuestion(BaseModel):
    question: str = Field(min_length=2, max_length=400)


class CopilotAnswer(BaseModel):
    question: str
    intent: str
    answer: str
    bullets: list[str]
    suggestions: list[str]
    data: dict
    read_only: bool = True
