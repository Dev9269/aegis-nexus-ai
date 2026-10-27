from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.api.deps import AuthContext
from app.api.schemas import Page
from app.core.errors import ApiError
from app.core.pagination import page_response
from app.core.roles import STAFF_ROLES
from app.domains.access.presenters import access_out
from app.domains.audit.presenters import audit_out
from app.domains.devices.presenters import device_out
from app.domains.events.presenters import event_out
from app.domains.identities import repository
from app.domains.identities.presenters import behavioral_signal_out, identity_summary
from app.domains.identities.schemas import IdentityDetail, IdentitySummary, RiskPoint
from app.security.sessions import active_session_count


def list_identities(
    db: Session, *, filters: dict[str, Any], page: int, page_size: int
) -> Page[IdentitySummary]:
    rows, total = repository.list_identity_rows(
        db,
        filters=filters,
        page=page,
        page_size=page_size,
    )
    return page_response(
        [identity_summary(identity) for identity in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


def get_identity(db: Session, *, identity_id: str, auth: AuthContext) -> IdentityDetail:
    identity = repository.get_identity_row(db, identity_id)
    if identity is None:
        raise ApiError(404, "IDENTITY_NOT_FOUND", "Identity not found.")
    is_staff = auth.identity.role in STAFF_ROLES
    if not is_staff and auth.identity.id != identity.id:
        raise ApiError(403, "FORBIDDEN", "You may only view your own identity.")

    sessions = repository.list_sessions(db, identity.id)
    devices = repository.list_devices(db, identity.id)
    recent_access = repository.list_recent_access(db, identity.id)
    behavior = repository.list_behavior(db, identity.id)
    alerts = repository.list_alerts(db, identity.id)
    audits = repository.list_audits(db, identity.id)
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
        alerts=[event_out(event) for event in alerts],
        audit_events=[audit_out(audit) for audit in audits],
    )
