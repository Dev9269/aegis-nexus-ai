from __future__ import annotations

from app.db.models import Identity, UserSession
from app.domains.auth.schemas import MeOut


def me_out(identity: Identity, session: UserSession, *, demo_mode: bool) -> MeOut:
    return MeOut(
        id=identity.id,
        display_name=identity.display_name,
        email=identity.email,
        role=identity.role,
        status=identity.status,
        department=identity.department,
        title=identity.title,
        current_risk=identity.current_risk,
        csrf_token=session.csrf_token,
        session_expires_at=session.expires_at,
        demo_mode=demo_mode,
    )
