from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import AuthContext, get_auth_context, login_limiter
from app.audit.service import append_audit
from app.core.config import get_settings
from app.core.database import get_db
from app.core.errors import ApiError
from app.models import Identity, Severity, new_id, utcnow
from app.schemas import LoginIn, MeOut
from app.security.passwords import hash_password, verify_password
from app.security.sessions import CSRF_COOKIE, SESSION_COOKIE, create_session, revoke_session
from app.services.events import record_event

router = APIRouter(prefix="/auth", tags=["authentication"])
settings = get_settings()
DUMMY_HASH = hash_password("aegis-dummy-password-not-for-login")


def _me_payload(auth: AuthContext) -> MeOut:
    return MeOut(
        id=auth.identity.id,
        display_name=auth.identity.display_name,
        email=auth.identity.email,
        role=auth.identity.role,
        status=auth.identity.status,
        department=auth.identity.department,
        title=auth.identity.title,
        current_risk=auth.identity.current_risk,
        csrf_token=auth.session.csrf_token,
        session_expires_at=auth.session.expires_at,
        demo_mode=settings.demo_mode,
    )


@router.post("/login", response_model=MeOut)
def login(
    payload: LoginIn,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> MeOut:
    client_ip = request.client.host if request.client else "unknown"
    limiter_key = f"{client_ip}:{payload.email}"
    if not login_limiter.allow(limiter_key):
        raise ApiError(
            429,
            "RATE_LIMITED",
            "Too many authentication attempts. Try again shortly.",
            headers={"Retry-After": str(settings.login_rate_window_seconds)},
        )

    identity = db.scalar(select(Identity).where(Identity.email == payload.email))
    valid = verify_password(payload.password, identity.password_hash if identity else DUMMY_HASH)
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
            metadata={"email": payload.email, "reason": "invalid_credentials_or_inactive_account"},
        )
        db.commit()
        raise ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password.")

    session, raw_token = create_session(
        db,
        identity,
        settings.session_ttl_minutes,
        ip_address=client_ip,
        user_agent=request.headers.get("user-agent"),
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
    response.set_cookie(
        SESSION_COOKIE,
        raw_token,
        max_age=max_age,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )
    response.set_cookie(
        CSRF_COOKIE,
        session.csrf_token,
        max_age=max_age,
        httponly=False,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )
    return _me_payload(AuthContext(identity=identity, session=session))


@router.get("/me", response_model=MeOut)
def me(auth: AuthContext = Depends(get_auth_context)) -> MeOut:
    return _me_payload(auth)


@router.post("/logout")
def logout(
    response: Response,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> dict[str, str]:
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
    response.delete_cookie(SESSION_COOKIE, path="/")
    response.delete_cookie(CSRF_COOKIE, path="/")
    return {"status": "logged_out"}
