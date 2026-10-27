from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Identity


def find_identity_by_email(db: Session, email: str) -> Identity | None:
    return db.scalar(select(Identity).where(Identity.email == email))
