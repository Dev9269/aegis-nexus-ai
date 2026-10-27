from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session

from app.api.deps import AuthContext, get_auth_context
from app.core.config import get_settings
from app.core.database import get_db
from app.domains.auth.schemas import LoginIn, MeOut
from app.domains.auth.service import (
    authenticate,
    logout as logout_service,
    me_payload,
)
from app.security.sessions import CSRF_COOKIE, SESSION_COOKIE

router = APIRouter(prefix="/auth", tags=["authentication"])
settings = get_settings()


@router.post("/login", response_model=MeOut)
def login(
    payload: LoginIn,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> MeOut:
    client_ip = request.client.host if request.client else "unknown"
    result = authenticate(
        db,
        email=payload.email,
        password=payload.password,
        client_ip=client_ip,
        user_agent=request.headers.get("user-agent"),
    )
    response.set_cookie(
        SESSION_COOKIE,
        result.raw_token,
        max_age=result.max_age_seconds,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )
    response.set_cookie(
        CSRF_COOKIE,
        result.csrf_token,
        max_age=result.max_age_seconds,
        httponly=False,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )
    return result.payload


@router.get("/me", response_model=MeOut)
def me(auth: AuthContext = Depends(get_auth_context)) -> MeOut:
    return me_payload(auth)


@router.post("/logout")
def logout(
    response: Response,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    logout_service(db, auth=auth)
    response.delete_cookie(SESSION_COOKIE, path="/")
    response.delete_cookie(CSRF_COOKIE, path="/")
    return {"status": "logged_out"}
