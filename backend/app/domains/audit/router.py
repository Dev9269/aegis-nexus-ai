from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.api.deps import AuthContext, require_roles
from app.api.schemas import Page
from app.core.database import get_db
from app.core.roles import STAFF_ROLES
from app.domains.audit.schemas import AuditOut, AuditVerifyOut
from app.domains.audit.service import (
    export_audit as export_audit_service,
    list_audit as list_audit_service,
    verify_audit_chain,
)

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("", response_model=Page[AuditOut])
def list_audit(
    q: str | None = Query(default=None, max_length=120),
    action: str | None = Query(default=None, max_length=80),
    actor_id: str | None = Query(default=None, max_length=36),
    target_type: str | None = Query(default=None, max_length=60),
    from_time: str | None = Query(default=None, max_length=40),
    to_time: str | None = Query(default=None, max_length=40),
    page: int = Query(default=1, ge=1, le=10000),
    page_size: int = Query(default=25, ge=1, le=100),
    auth: AuthContext = Depends(require_roles(*STAFF_ROLES)),
    db: Session = Depends(get_db),
) -> Page[AuditOut]:
    return list_audit_service(
        db,
        filters={
            "q": q,
            "action": action,
            "actor_id": actor_id,
            "target_type": target_type,
            "from_time": from_time,
            "to_time": to_time,
        },
        page=page,
        page_size=page_size,
    )


@router.get("/verify", response_model=AuditVerifyOut)
def verify_chain(
    auth: AuthContext = Depends(require_roles(*STAFF_ROLES)),
    db: Session = Depends(get_db),
) -> AuditVerifyOut:
    valid, checked, invalid_id, message = verify_audit_chain(db)
    return AuditVerifyOut(
        valid=valid,
        checked_records=checked,
        first_invalid_id=invalid_id,
        message=message,
    )


@router.get("/export.csv")
def export_audit(
    q: str | None = Query(default=None, max_length=120),
    action: str | None = Query(default=None, max_length=80),
    actor_id: str | None = Query(default=None, max_length=36),
    target_type: str | None = Query(default=None, max_length=60),
    from_time: str | None = Query(default=None, max_length=40),
    to_time: str | None = Query(default=None, max_length=40),
    auth: AuthContext = Depends(require_roles(*STAFF_ROLES)),
    db: Session = Depends(get_db),
) -> Response:
    export = export_audit_service(
        db,
        actor=auth.identity,
        filters={
            "q": q,
            "action": action,
            "actor_id": actor_id,
            "target_type": target_type,
            "from_time": from_time,
            "to_time": to_time,
        },
    )
    return Response(
        content=export.content,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{export.filename}"',
            "X-Correlation-ID": export.correlation_id,
        },
    )
