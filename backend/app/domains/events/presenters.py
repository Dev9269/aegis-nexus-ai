from __future__ import annotations

from app.db.models import SecurityEvent
from app.domains.events.schemas import SecurityEventOut


def event_out(event: SecurityEvent) -> SecurityEventOut:
    return SecurityEventOut.model_validate(event)
