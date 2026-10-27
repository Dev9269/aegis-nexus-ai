from __future__ import annotations

import pytest
from sqlalchemy import text

from app.core.config import Settings, validate_runtime_settings
from app.core.database import get_db


def test_get_db_rolls_back_uncommitted_work(monkeypatch):
    generator = get_db()
    db = next(generator)
    rollbacks: list[bool] = []
    original_rollback = db.rollback

    def tracked_rollback() -> None:
        rollbacks.append(True)
        original_rollback()

    monkeypatch.setattr(db, "rollback", tracked_rollback)
    db.execute(text("CREATE TEMP TABLE rollback_probe (value INTEGER)"))
    db.execute(text("INSERT INTO rollback_probe VALUES (1)"))
    db.flush()
    with pytest.raises(RuntimeError):
        generator.throw(RuntimeError("boom"))
    assert rollbacks == [True]
    assert db.in_transaction() is False
    db.close()


def test_production_configuration_fails_closed(monkeypatch):
    settings = Settings(
        environment="production",
        cookie_secure=False,
        demo_mode=True,
        allowed_origins="*",
    )
    with pytest.raises(ValueError):
        validate_runtime_settings(settings)
