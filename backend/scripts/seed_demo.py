from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import get_settings  # noqa: E402
from app.core.database import SessionLocal, init_db  # noqa: E402
from app.seed import seed_demo_data  # noqa: E402


def main() -> None:
    settings = get_settings()
    if not settings.demo_mode:
        print(
            "Refusing to seed demo accounts because AEGIS_DEMO_MODE is disabled.",
            file=sys.stderr,
        )
        raise SystemExit(2)
    init_db()
    with SessionLocal() as db:
        result = seed_demo_data(db)
    if result.created:
        print(
            f"Seed complete: {result.identities} identities, {result.devices} devices, "
            f"{result.incidents} incidents."
        )
        print("Demo password: AEGIS_DEMO_PASSWORD when set; otherwise the built-in demo default.")
    else:
        print("Demo data already exists. Use the demo reset action to recreate simulated data.")


if __name__ == "__main__":
    main()
