from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import AuthContext, get_auth_context, require_roles
from app.core.database import get_db
from app.core.errors import ApiError
from app.models import (
    AccessRequest,
    AuditLog,
    BehavioralEvent,
    Device,
    Identity,
    SecurityEvent,
    UserSession,
)
from app.schemas import IdentityDetail, IdentitySummary, Page, RiskPoint
from app.security.sessions import active_session_count
from app.serializers import (
    access_out,
    behavioral_signal_out,
    device_out,
    identity_summary,
)

router = APIRouter(prefix="/identities", tags=["identities"])
Staff = Literal["SECURITY_ADMIN", "SECURITY_ANALYST", "AUDITOR"]


@router.get("", response_model=Page[IdentitySummary])
def list_identities(
    q: str | None = Query(default=None, max_length=120),
    role: Staff | str | None = Query(default=None),
    status: Literal["ACTIVE", "DISABLED"] | None = Query(default=None),
    page: int = Query(default=1, ge=1, le=10000),
    page_size: int = Query(default=20, ge=1, le=100),
    auth: AuthContext = Depends(require_roles("SECURITY_ADMIN", "SECURITY_ANALYST", "AUDITOR")),
    db: Session = Depends(get_db),
) -> Page[IdentitySummary]:
    query = select(Identity)
    count_query = select(func.count(Identity.id))
    filters = []
    if q:
        pattern = f"%{q.strip()}%"
        filters.append(
            or_(
                Identity.display_name.ilike(pattern),
                Identity.email.ilike(pattern),
                Identity.department.ilike(pattern),
                Identity.title.ilike(pattern),
            )
        )
    if role:
        filters.append(Identity.role == role)
    if status:
        filters.append(Identity.status == status)
    if filters:
        query = query.where(*filters)
        count_query = count_query.where(*filters)
    total = int(db.scalar(count_query) or 0)
    identities = list(
        db.scalars(
            query.order_by(Identity.current_risk.desc(), Identity.display_name.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    )
    return Page(
        items=[identity_summary(identity) for identity in identities],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{identity_id}", response_model=IdentityDetail)
def get_identity(
    identity_id: str,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> IdentityDetail:
    identity = db.get(Identity, identity_id)
    if identity is None:
        raise ApiError(404, "IDENTITY_NOT_FOUND", "Identity not found.")
    is_staff = auth.identity.role in {"SECURITY_ADMIN", "SECURITY_ANALYST", "AUDITOR"}
    if not is_staff and auth.identity.id != identity.id:
        raise ApiError(403, "FORBIDDEN", "You may only view your own identity.")

    sessions = list(
        db.scalars(
            select(UserSession)
            .where(UserSession.identity_id == identity.id)
            .order_by(UserSession.created_at.desc())
            .limit(10)
        )
    )
    devices = list(
        db.scalars(
            select(Device)
            .where(Device.identity_id == identity.id)
            .order_by(Device.last_observed_at.desc().nullslast())
        )
    )
    recent_access = list(
        db.scalars(
            select(AccessRequest)
            .where(AccessRequest.identity_id == identity.id)
            .order_by(AccessRequest.created_at.desc())
            .limit(10)
        )
    )
    behavior = list(
        db.scalars(
            select(BehavioralEvent)
            .where(BehavioralEvent.identity_id == identity.id)
            .order_by(BehavioralEvent.detected_at.desc())
            .limit(30)
        )
    )
    alerts = list(
        db.scalars(
            select(SecurityEvent)
            .where(
                SecurityEvent.identity_id == identity.id,
                SecurityEvent.severity.in_(["HIGH", "CRITICAL"]),
            )
            .order_by(SecurityEvent.timestamp.desc())
            .limit(10)
        )
    )
    audits = list(
        db.scalars(
            select(AuditLog)
            .where(
                or_(
                    AuditLog.target_id == identity.id,
                    AuditLog.actor_id == identity.id,
                )
            )
            .order_by(AuditLog.sequence.desc())
            .limit(10)
        )
    )
    risk_history = [
        RiskPoint(
            timestamp=event.detected_at,
            risk_score=event.risk_score,
            risk_category=event.risk_category,
            source="isolation_forest",
        )
        for event in reversed(behavior)
    ]

    return IdentityDetail(
        **identity_summary(identity).model_dump(),
        created_at=identity.created_at,
        active_sessions=active_session_count(db, identity.id),
        sessions=sessions,
        devices=[device_out(device) for device in devices],
        recent_access=[access_out(request) for request in recent_access],
        behavioral_signals=[behavioral_signal_out(event) for event in behavior[:10]],
        risk_history=risk_history,
        alerts=alerts,
        audit_events=audits,
    )
