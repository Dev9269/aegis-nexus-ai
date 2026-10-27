from __future__ import annotations

from app.db.models import AuditLog
from app.domains.audit.schemas import AuditOut


def audit_out(record: AuditLog) -> AuditOut:
    return AuditOut.model_validate(record)
