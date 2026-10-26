from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit.service import append_audit
from app.core.config import Settings
from app.models import Identity, Role, new_id
from app.security.passwords import hash_password
from app.seed import seed_demo_data

MIN_BOOTSTRAP_PASSWORD_LENGTH = 12


def ensure_bootstrap_admin(db: Session, settings: Settings) -> bool:
    if settings.demo_mode:
        return seed_demo_data(db).created

    email = (settings.bootstrap_admin_email or "").strip().lower()
    password = settings.bootstrap_admin_password or ""
    if not email or not password:
        raise ValueError(
            "bootstrap admin email and password are required when demo mode is disabled."
        )
    if len(password) < MIN_BOOTSTRAP_PASSWORD_LENGTH:
        raise ValueError(
            f"bootstrap admin password must be at least {MIN_BOOTSTRAP_PASSWORD_LENGTH} characters."
        )

    existing = db.scalar(select(Identity.id).limit(1))
    if existing is not None:
        return False

    identity = Identity(
        display_name=settings.bootstrap_admin_name.strip() or "Bootstrap Admin",
        email=email,
        password_hash=hash_password(password),
        role=Role.SECURITY_ADMIN.value,
        status="ACTIVE",
        department="Security",
        title="Security Administrator",
        is_simulated=False,
    )
    db.add(identity)
    db.flush()

    append_audit(
        db,
        actor=identity,
        action="BOOTSTRAP_ADMIN_CREATED",
        target_type="identity",
        target_id=identity.id,
        correlation_id=new_id(),
        metadata={"email": email},
    )
    db.commit()
    return True
