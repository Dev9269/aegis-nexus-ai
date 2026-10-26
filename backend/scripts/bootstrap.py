from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import get_settings, validate_runtime_settings  # noqa: E402
from app.core.database import SessionLocal, init_db  # noqa: E402
from app.services.bootstrap import ensure_bootstrap_admin  # noqa: E402


def main() -> None:
    settings = get_settings()
    validate_runtime_settings(settings)
    if settings.auto_create_tables:
        init_db()
    with SessionLocal() as db:
        created = ensure_bootstrap_admin(db, settings)
    if created:
        mode = "demo data" if settings.demo_mode else "bootstrap administrator"
        print(f"Bootstrap complete: {mode} created.")
    else:
        print("Bootstrap skipped: an identity already exists.")


if __name__ == "__main__":
    main()
