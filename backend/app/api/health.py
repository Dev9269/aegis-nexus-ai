from __future__ import annotations

import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Response

from app.api.deps import AuthContext, get_auth_context
from app.audit.service import verify_audit_chain
from app.core.config import get_settings
from app.core.database import SessionLocal, database_is_available
from app.realtime import realtime
from app.schemas import HealthStatus

router = APIRouter(prefix="/health", tags=["health"])
settings = get_settings()


@router.get("")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "aegis-nexus-ai",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def build_health_status() -> HealthStatus:
    metadata_path = settings.artifact_path / "metadata.json"
    model_version: str | None = None
    model_status = "not_trained"
    if metadata_path.exists():
        try:
            metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
            model_version = metadata.get("model_version")
            model_status = "available"
        except (json.JSONDecodeError, OSError):
            model_status = "degraded"
    return HealthStatus(
        api="operational",
        database="connected" if database_is_available() else "unavailable",
        model=model_status,
        event_stream="connected" if realtime.client_count > 0 else "ready",
        model_version=model_version,
        stream_clients=realtime.client_count,
        checked_at=datetime.now(timezone.utc),
    )


@router.get("/ready")
def readiness(response: Response) -> dict[str, object]:
    database_ok = database_is_available()
    audit_ok = False
    if database_ok:
        try:
            with SessionLocal() as db:
                audit_ok = verify_audit_chain(db)[0]
        except Exception:
            audit_ok = False
    checks = {
        "database": "ok" if database_ok else "unavailable",
        "audit_chain": "ok" if audit_ok else "unavailable",
    }
    ready = database_ok and audit_ok
    if not ready:
        response.status_code = 503
    return {"status": "ready" if ready else "not_ready", "checks": checks}


@router.get("/detailed", response_model=HealthStatus)
def detailed_health(auth: AuthContext = Depends(get_auth_context)) -> HealthStatus:
    return build_health_status()
