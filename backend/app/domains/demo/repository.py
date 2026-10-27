from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.db.models import (
    AccessPolicy,
    AccessRequest,
    BehavioralEvent,
    Device,
    Identity,
    Incident,
    IncidentNote,
    Resource,
    SecurityEvent,
    UserSession,
)

RESET_DELETE_ORDER = (
    IncidentNote,
    Incident,
    AccessRequest,
    BehavioralEvent,
    UserSession,
    Device,
    AccessPolicy,
    Resource,
    SecurityEvent,
    Identity,
)


def find_identity_by_email(db: Session, email: str) -> Identity | None:
    return db.scalar(select(Identity).where(Identity.email == email))


def find_resource_by_key(db: Session, key: str) -> Resource | None:
    return db.scalar(select(Resource).where(Resource.key == key))


def find_device(db: Session, identity_id: str, name: str) -> Device | None:
    return db.scalar(
        select(Device).where(
            Device.identity_id == identity_id,
            Device.name == name,
        )
    )


def delete_demo_data(db: Session) -> None:
    for model in RESET_DELETE_ORDER:
        db.execute(delete(model))
    db.flush()


def find_admin(db: Session) -> Identity | None:
    return db.scalar(select(Identity).where(Identity.email == "admin@aegisnexus.ai"))
