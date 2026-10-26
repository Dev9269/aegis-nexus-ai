from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.database import SessionLocal
from app.security.sessions import CSRF_COOKIE, SESSION_COOKIE, resolve_session

UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
CSRF_EXEMPT_PATHS = {"/api/auth/login"}


def _csrf_failure() -> JSONResponse:
    return JSONResponse(
        status_code=403,
        content={
            "error": {
                "code": "CSRF_VALIDATION_FAILED",
                "message": "A valid CSRF token is required for this request.",
            }
        },
    )


class CSRFMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path.rstrip("/") or "/"
        if request.method in UNSAFE_METHODS and path.startswith("/api") and path not in CSRF_EXEMPT_PATHS:
            raw_session = request.cookies.get(SESSION_COOKIE)
            cookie_token = request.cookies.get(CSRF_COOKIE)
            if raw_session or cookie_token:
                header_token = request.headers.get("X-CSRF-Token")
                if not header_token or not cookie_token or header_token != cookie_token:
                    return _csrf_failure()
                if raw_session:
                    db = SessionLocal()
                    try:
                        session = resolve_session(db, raw_session)
                    finally:
                        db.close()
                    if session is not None and header_token != session.csrf_token:
                        return _csrf_failure()
        return await call_next(request)
