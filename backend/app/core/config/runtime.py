from __future__ import annotations


class RuntimeFields:
    environment: str = "development"
    allowed_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    demo_mode: bool = True
    demo_password: str = "ChangeMe-Demo!2026"

    @property
    def allowed_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]

    @property
    def is_development(self) -> bool:
        return self.environment.lower() in {"development", "dev", "local", "test"}
