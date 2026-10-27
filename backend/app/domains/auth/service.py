from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.api.deps import AuthContext, login_limiter
from app.audit.service import append_audit
from app.core.config import get_settings
from app.core.errors import ApiError
from app.db.models import Severity, new_id, utcnow
from app.domains.auth import repository
from app.domains.auth.presenters import me_out
from app.domains.auth.schemas import MeOut
from app.security.passwords import hash_password, verify_password
from app.security.sessions import create_session, revoke_session
from app.services.events import record_event

settings = get_settings()
DUMMY_HASH = hash_password("aegis-dummy-password-not-for-login")


@dataclass(frozen=True)
class LoginResult:
    payload: MeOut
    raw_token: str
    csrf_token: str
    max_age_seconds: int


def me_payload(auth: AuthContext) -> MeOut:
    return me_out(auth.identity, auth.session, demo_mode=settings.demo_mode)


def authenticate(
    db: Session,
    *,
    email: str,
    password: str,
    client_ip: str,
    user_agent: str | None,
) -> LoginResult:
    limiter_key = f"{client_ip}:{email}"
    if not login_limiter.allow(limiter_key):
        raise ApiError(
            429,
            "RATE_LIMITED",
            "Too many authentication attempts. Try again shortly.",
            headers={"Retry-After": str(settings.login_rate_window_seconds)},
        )

    identity = repository.find_identity_by_email(db, email)
    valid = verify_password(password, identity.password_hash if identity else DUMMY_HASH)
    if identity is None or not valid or identity.status != "ACTIVE":
        correlation_id = new_id()
        record_event(
            db,
            event_type="AUTH_FAILURE",
            category="Authentication",
            summary="Failed authentication attempt",
            correlation_id=correlation_id,
            severity=Severity.MEDIUM.value,
            identity_id=identity.id if identity else None,
            details={"reason": "invalid_credentials_or_inactive_account"},
        )
        append_audit(
            db,
            actor=None,
            actor_label="unauthenticated",
            action="LOGIN_FAILED",
            target_type="identity",
            target_id=identity.id if identity else None,
            correlation_id=correlation_id,
            result="FAILURE",
            metadata={"email": email, "reason": "invalid_credentials_or_inactive_account"},
        )
        db.commit()
        raise ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password.")

    session, raw_token = create_session(
        db,
        identity,
        settings.session_ttl_minutes,
        ip_address=client_ip,
        user_agent=user_agent,
    )
    identity.last_activity_at = utcnow()
    correlation_id = new_id()
    record_event(
        db,
        event_type="AUTH_SUCCESS",
        category="Authentication",
        summary=f"Successful authentication for {identity.display_name}",
        correlation_id=correlation_id,
        severity=Severity.LOW.value,
        identity_id=identity.id,
        actor_id=identity.id,
        details={"role": identity.role},
    )
    append_audit(
        db,
        actor=identity,
        action="LOGIN_SUCCESS",
        target_type="identity",
        target_id=identity.id,
        correlation_id=correlation_id,
        metadata={"role": identity.role, "session_id": session.id},
    )
    db.commit()
    db.refresh(session)

    max_age = settings.session_ttl_minutes * 60
    return LoginResult(
        payload=me_out(
            identity,
            session,
            demo_mode=settings.demo_mode,
        ),
        raw_token=raw_token,
        csrf_token=session.csrf_token,
        max_age_seconds=max_age,
    )


def logout(db: Session, *, auth: AuthContext) -> None:
    revoke_session(db, auth.session)
    correlation_id = new_id()
    record_event(
        db,
        event_type="SESSION_REVOKED",
        category="Session",
        summary=f"Session revoked for {auth.identity.display_name}",
        correlation_id=correlation_id,
        severity=Severity.LOW.value,
        identity_id=auth.identity.id,
        actor_id=auth.identity.id,
        details={"session_id": auth.session.id, "reason": "user_logout"},
    )
    append_audit(
        db,
        actor=auth.identity,
        action="LOGOUT",
        target_type="session",
        target_id=auth.session.id,
        correlation_id=correlation_id,
        metadata={"reason": "user_logout"},
    )
    db.commit()
