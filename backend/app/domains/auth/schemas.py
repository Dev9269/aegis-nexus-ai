from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class LoginIn(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=256)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class MeOut(BaseModel):
    id: str
    display_name: str
    email: str
    role: str
    status: str
    department: str
    title: str
    current_risk: float
    csrf_token: str
    session_expires_at: datetime
    demo_mode: bool
