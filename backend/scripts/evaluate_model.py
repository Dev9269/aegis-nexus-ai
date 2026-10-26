from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import get_settings  # noqa: E402
from app.ml.runtime import get_evaluation, model_available  # noqa: E402


def main() -> None:
    settings = get_settings()
    if not model_available():
        raise SystemExit("No model artifact found. Run scripts/train_model.py first.")
    report = get_evaluation()
    print(json.dumps(report, indent=2))
    print(f"Evaluation source: {settings.artifact_path / 'evaluation.json'}")


if __name__ == "__main__":
    main()
