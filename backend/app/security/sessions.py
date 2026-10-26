from __future__ import annotations

from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.time import as_utc
from app.models import Identity, UserSession, utcnow
from app.security.tokens import new_csrf_token, new_session_token, token_digest

SESSION_COOKIE = "aegis_session"
CSRF_COOKIE = "aegis_csrf"


def create_session(
    db: Session,
    identity: Identity,
    ttl_minutes: int,
    *,
    ip_address: str | None = None,
    user_agent: str | None = None,
    is_simulated: bool = False,
) -> tuple[UserSession, str]:
    raw_token = new_session_token()
    session = UserSession(
        identity_id=identity.id,
        token_hash=token_digest(raw_token),
        csrf_token=new_csrf_token(),
        created_at=utcnow(),
        expires_at=utcnow() + timedelta(minutes=ttl_minutes),
        ip_address=ip_address,
        user_agent=(user_agent or "")[:255] or None,
        is_simulated=is_simulated,
    )
    db.add(session)
    db.flush()
    return session, raw_token


def resolve_session(db: Session, raw_token: str | None) -> UserSession | None:
    if not raw_token:
        return None
    session = db.scalar(
        select(UserSession).where(UserSession.token_hash == token_digest(raw_token))
    )
    if session is None or session.revoked_at is not None:
        return None
    expires_at = as_utc(session.expires_at)
    if expires_at is None or expires_at <= utcnow():
        return None
    return session


def revoke_session(db: Session, session: UserSession) -> None:
    if session.revoked_at is None:
        session.revoked_at = utcnow()


def revoke_identity_sessions(db: Session, identity_id: str) -> int:
    sessions = list(
        db.scalars(
            select(UserSession).where(
                UserSession.identity_id == identity_id,
                UserSession.revoked_at.is_(None),
            )
        )
    )
    for session in sessions:
        session.revoked_at = utcnow()
    db.flush()
    return len(sessions)


def active_session_count(db: Session, identity_id: str | None = None) -> int:
    query = select(UserSession).where(
        UserSession.revoked_at.is_(None),
        UserSession.expires_at > utcnow(),
    )
    if identity_id:
        query = query.where(UserSession.identity_id == identity_id)
    return len(list(db.scalars(query)))
