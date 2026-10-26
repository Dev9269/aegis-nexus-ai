from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import get_settings  # noqa: E402
from app.ml.runtime import clear_cache  # noqa: E402
from ml.training.train import train_model  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Train the AEGIS behavioral anomaly model.")
    parser.add_argument("--rows", type=int, default=5000)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--artifact-dir", type=str, default=None)
    args = parser.parse_args()

    settings = get_settings()
    artifact_dir = Path(args.artifact_dir) if args.artifact_dir else settings.artifact_path
    result = train_model(artifact_dir=artifact_dir, seed=args.seed, rows=args.rows)
    clear_cache()
    print(json.dumps(result, indent=2))
    print(f"Model artifacts written to: {artifact_dir}")


if __name__ == "__main__":
    main()
