from __future__ import annotations

import asyncio
import logging
import re
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from time import perf_counter
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import (
    access,
    audit,
    auth,
    demo,
    devices,
    events,
    health,
    identities,
    incidents,
    model,
    overview,
    policies,
    settings as settings_api,
)
from app.core.config import get_settings, validate_runtime_settings
from app.core.database import init_db
from app.core.errors import ApiError
from app.core.logging import configure_logging, request_id_var
from app.realtime import realtime
from app.security.csrf import CSRFMiddleware

settings = get_settings()
logger = logging.getLogger("aegis.request")
_REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9._-]{1,64}$")


def _error(status_code: int, code: str, message: str, details=None, headers=None) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": code, "message": message, "details": details}},
        headers=headers,
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    validate_runtime_settings(settings)
    if settings.auto_create_tables:
        init_db()
    realtime.bind_loop(asyncio.get_running_loop())
    yield


def create_app() -> FastAPI:
    configure_logging(settings.environment)
    application = FastAPI(
        title="AEGIS NEXUS AI",
        description=(
            "Adaptive Engine for Governance, Identity Security & Network User eXamination. "
            "Zero-trust access decisions with explainable behavioral anomaly detection."
        ),
        version="0.1.0",
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origin_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "X-CSRF-Token", "Authorization"],
        max_age=600,
    )
    application.add_middleware(CSRFMiddleware)

    @application.middleware("http")
    async def security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["Cache-Control"] = "no-store"
        return response

    @application.middleware("http")
    async def request_context(request: Request, call_next):
        supplied = request.headers.get("X-Request-ID", "")
        request_id = supplied if _REQUEST_ID_PATTERN.fullmatch(supplied) else uuid4().hex
        request.state.request_id = request_id
        token = request_id_var.set(request_id)
        started = perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            logger.exception(
                "request_failed",
                extra={
                    "method": request.method,
                    "path": request.url.path,
                    "duration_ms": round((perf_counter() - started) * 1000, 2),
                },
            )
            raise
        else:
            response.headers["X-Request-ID"] = request_id
            logger.info(
                "request_completed",
                extra={
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": response.status_code,
                    "duration_ms": round((perf_counter() - started) * 1000, 2),
                },
            )
            return response
        finally:
            request_id_var.reset(token)

    @application.exception_handler(ApiError)
    async def api_error_handler(request: Request, exc: ApiError):
        return _error(exc.status_code, exc.code, exc.message, exc.details, exc.headers)

    @application.exception_handler(HTTPException)
    async def http_error_handler(request: Request, exc: HTTPException):
        message = exc.detail if isinstance(exc.detail, str) else "Request failed."
        return _error(exc.status_code, "HTTP_ERROR", message, headers=exc.headers)

    @application.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, exc: RequestValidationError):
        details = [
            {
                "location": ".".join(str(part) for part in error["loc"]),
                "message": error["msg"],
                "type": error["type"],
            }
            for error in exc.errors()
        ]
        return _error(422, "VALIDATION_ERROR", "Request validation failed.", details)

    @application.exception_handler(Exception)
    async def unhandled_error_handler(request: Request, exc: Exception):
        logger.error(
            "unhandled_exception",
            exc_info=(type(exc), exc, exc.__traceback__),
            extra={"method": request.method, "path": request.url.path},
        )
        return _error(
            500,
            "INTERNAL_ERROR",
            "An internal error occurred. No sensitive details are exposed.",
        )

    application.include_router(health.router, prefix="/api")
    application.include_router(auth.router, prefix="/api")
    application.include_router(identities.router, prefix="/api")
    application.include_router(devices.router, prefix="/api")
    application.include_router(access.router, prefix="/api")
    application.include_router(policies.router, prefix="/api")
    application.include_router(events.router, prefix="/api")
    application.include_router(incidents.router, prefix="/api")
    application.include_router(overview.router, prefix="/api")
    application.include_router(model.router, prefix="/api")
    application.include_router(audit.router, prefix="/api")
    application.include_router(settings_api.router, prefix="/api")
    application.include_router(demo.router, prefix="/api")

    @application.get("/api", tags=["meta"])
    def api_root() -> dict[str, str]:
        return {
            "name": "AEGIS NEXUS AI",
            "tagline": "Trust Nothing. Verify Everything. Adapt Intelligently.",
            "version": "0.1.0",
            "time": datetime.now(timezone.utc).isoformat(),
        }

    return application


app = create_app()
