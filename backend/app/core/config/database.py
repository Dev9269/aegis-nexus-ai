from __future__ import annotations

from app.core.paths import BACKEND_DIR


class DatabaseFields:
    database_url: str = "sqlite:///./aegis.db"
    auto_create_tables: bool = True

    @property
    def resolved_database_url(self) -> str:
        if self.database_url.startswith("sqlite:///./"):
            relative = self.database_url.removeprefix("sqlite:///./")
            return f"sqlite:///{(BACKEND_DIR / relative).as_posix()}"
        return self.database_url
