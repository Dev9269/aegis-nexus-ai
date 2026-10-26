from __future__ import annotations

from dataclasses import dataclass

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.errors import ApiError
from app.models import Identity, UserSession
from app.security.sessions import SESSION_COOKIE, resolve_session
from app.security.tokens import InMemoryRateLimiter

settings = get_settings()
login_limiter = InMemoryRateLimiter(
    limit=settings.login_rate_limit,
    window_seconds=settings.login_rate_window_seconds,
)


@dataclass(frozen=True)
class AuthContext:
    identity: Identity
    session: UserSession


def get_auth_context(request: Request, db: Session = Depends(get_db)) -> AuthContext:
    raw_token = request.cookies.get(SESSION_COOKIE)
    session = resolve_session(db, raw_token)
    if session is None:
        raise ApiError(401, "NOT_AUTHENTICATED", "Authentication is required.")
    identity = db.get(Identity, session.identity_id)
    if identity is None or identity.status != "ACTIVE":
        raise ApiError(401, "NOT_AUTHENTICATED", "Authentication is required.")
    return AuthContext(identity=identity, session=session)


def get_current_identity(auth: AuthContext = Depends(get_auth_context)) -> Identity:
    return auth.identity


def require_roles(*roles: str):
    allowed = set(roles)

    def dependency(auth: AuthContext = Depends(get_auth_context)) -> AuthContext:
        if auth.identity.role not in allowed:
            raise ApiError(
                403,
                "FORBIDDEN",
                "Your role does not permit this action.",
                details={"required_roles": sorted(allowed)},
            )
        return auth

    return dependency
