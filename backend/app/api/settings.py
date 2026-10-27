from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import AuthContext, require_roles
from app.core.config import get_settings
from app.core.roles import STAFF_ROLES
from app.ml.runtime import get_metadata, model_available
from app.ml.scoring import MODEL_LIMITATIONS
from app.schemas import SettingsInfoOut

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/info", response_model=SettingsInfoOut)
def settings_info(
    auth: AuthContext = Depends(require_roles(*STAFF_ROLES)),
) -> SettingsInfoOut:
    settings = get_settings()
    available = model_available()
    return SettingsInfoOut(
        environment=settings.environment,
        demo_mode=settings.demo_mode,
        session_ttl_minutes=settings.session_ttl_minutes,
        login_rate_limit=settings.login_rate_limit,
        login_rate_window_seconds=settings.login_rate_window_seconds,
        allowed_origins=settings.allowed_origin_list,
        model_artifact_available=available,
        model_version=get_metadata().get("model_version") if available else None,
        limitations=MODEL_LIMITATIONS,
    )
