from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

from app.core.config.auth import AuthFields
from app.core.config.bootstrap import BootstrapFields
from app.core.config.database import DatabaseFields
from app.core.config.limits import LimitFields
from app.core.config.model import ModelFields
from app.core.config.runtime import RuntimeFields


class Settings(
    RuntimeFields,
    DatabaseFields,
    AuthFields,
    BootstrapFields,
    ModelFields,
    LimitFields,
    BaseSettings,
):
    model_config = SettingsConfigDict(
        env_prefix="AEGIS_",
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
