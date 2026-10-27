from __future__ import annotations

from datetime import datetime, timezone

from app.audit.service import verify_audit_chain
from app.core.config import get_settings
from app.core.database import SessionLocal, database_is_available
from app.domains.system import repository
from app.domains.system.schemas import HealthStatus, SettingsInfoOut
from app.ml.runtime import get_metadata, model_available
from app.ml.scoring import MODEL_LIMITATIONS
from app.realtime import realtime

settings = get_settings()


def api_metadata() -> dict[str, str]:
    return {
        "name": "AEGIS NEXUS AI",
        "tagline": "Trust Nothing. Verify Everything. Adapt Intelligently.",
        "version": "0.1.0",
        "time": datetime.now(timezone.utc).isoformat(),
    }


def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "aegis-nexus-ai",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def build_health_status() -> HealthStatus:
    model_version, model_status = repository.read_model_metadata(settings.artifact_path)
    return HealthStatus(
        api="operational",
        database="connected" if database_is_available() else "unavailable",
        model=model_status,
        event_stream="connected" if realtime.client_count > 0 else "ready",
        model_version=model_version,
        stream_clients=realtime.client_count,
        checked_at=datetime.now(timezone.utc),
    )


def readiness() -> tuple[dict[str, object], bool]:
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
    return {"status": "ready" if ready else "not_ready", "checks": checks}, ready


def settings_info() -> SettingsInfoOut:
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
