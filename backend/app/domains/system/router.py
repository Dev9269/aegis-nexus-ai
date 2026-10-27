from __future__ import annotations

from fastapi import APIRouter, Depends, Response

from app.api.deps import AuthContext, get_auth_context, require_roles
from app.core.roles import STAFF_ROLES
from app.domains.system.schemas import HealthStatus, SettingsInfoOut
from app.domains.system.service import (
    api_metadata,
    build_health_status,
    health as health_service,
    readiness as readiness_service,
    settings_info as settings_info_service,
)

router = APIRouter()


@router.get("", tags=["meta"])
def api_root() -> dict[str, str]:
    return api_metadata()


@router.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return health_service()


@router.get("/health/ready", tags=["health"])
def readiness(response: Response) -> dict[str, object]:
    payload, ready = readiness_service()
    if not ready:
        response.status_code = 503
    return payload


@router.get("/health/detailed", response_model=HealthStatus, tags=["health"])
def detailed_health(auth: AuthContext = Depends(get_auth_context)) -> HealthStatus:
    return build_health_status()


@router.get("/settings/info", response_model=SettingsInfoOut, tags=["settings"])
def settings_info(
    auth: AuthContext = Depends(require_roles(*STAFF_ROLES)),
) -> SettingsInfoOut:
    return settings_info_service()

