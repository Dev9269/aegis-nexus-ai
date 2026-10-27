from __future__ import annotations

from pathlib import Path

from app.core.paths import BACKEND_DIR


class ModelFields:
    model_artifact_dir: str = "ml/artifacts"

    @property
    def artifact_path(self) -> Path:
        path = Path(self.model_artifact_dir)
        return path if path.is_absolute() else BACKEND_DIR / path
