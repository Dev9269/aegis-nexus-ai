from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app.main import app  # noqa: E402

OUTPUT = ROOT / "frontend" / "openapi.json"


def main() -> None:
    OUTPUT.write_text(
        json.dumps(app.openapi(), indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
