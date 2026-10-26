from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    environment: str = "development"
    database_url: str = "sqlite:///./aegis.db"
    allowed_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    demo_mode: bool = True
    demo_password: str = "ChangeMe-Demo!2026"
    session_ttl_minutes: int = 60
    cookie_secure: bool = False
    auto_create_tables: bool = True
    model_artifact_dir: str = "ml/artifacts"
    login_rate_limit: int = 8
    login_rate_window_seconds: int = 60
    ws_revalidation_seconds: int = 15
    bootstrap_admin_email: str | None = None
    bootstrap_admin_password: str | None = None
    bootstrap_admin_name: str = "Bootstrap Admin"

    model_config = SettingsConfigDict(
        env_prefix="AEGIS_",
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def allowed_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]

    @property
    def is_development(self) -> bool:
        return self.environment.lower() in {"development", "dev", "local", "test"}

    @property
    def resolved_database_url(self) -> str:
        if self.database_url.startswith("sqlite:///./"):
            relative = self.database_url.removeprefix("sqlite:///./")
            return f"sqlite:///{(BACKEND_DIR / relative).as_posix()}"
        return self.database_url

    @property
    def artifact_path(self) -> Path:
        path = Path(self.model_artifact_dir)
        return path if path.is_absolute() else BACKEND_DIR / path


def validate_runtime_settings(settings: Settings) -> None:
    if settings.is_development:
        return
    if not settings.cookie_secure:
        raise ValueError("AEGIS_COOKIE_SECURE must be true outside development.")
    if settings.demo_mode:
        raise ValueError("demo mode must be disabled outside development.")
    if "*" in settings.allowed_origin_list:
        raise ValueError("Wildcard CORS origins are not allowed outside development.")


@lru_cache
def get_settings() -> Settings:
    return Settings()
