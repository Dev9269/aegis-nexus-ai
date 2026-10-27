from __future__ import annotations

import json
from pathlib import Path


def read_model_metadata(artifact_path: Path) -> tuple[str | None, str]:
    metadata_path = artifact_path / "metadata.json"
    if not metadata_path.exists():
        return None, "not_trained"
    try:
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None, "degraded"
    return metadata.get("model_version"), "available"
