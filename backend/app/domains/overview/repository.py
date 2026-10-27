from __future__ import annotations

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import AccessRequest, BehavioralEvent, Identity, SecurityEvent
from app.security.sessions import active_session_count as session_count


def access_requests_in_range(
    db: Session, start: datetime, end: datetime
) -> list[AccessRequest]:
    return list(
        db.scalars(
            select(AccessRequest).where(
                AccessRequest.created_at >= start,
                AccessRequest.created_at <= end,
            )
        )
    )


def events_in_range(
    db: Session, start: datetime, end: datetime
) -> list[SecurityEvent]:
    return list(
        db.scalars(
            select(SecurityEvent).where(
                SecurityEvent.timestamp >= start,
                SecurityEvent.timestamp <= end,
            )
        )
    )


def identities_in_range(db: Session) -> list[Identity]:
    return list(
        db.scalars(select(Identity).order_by(Identity.current_risk.desc()))
    )


def active_session_count(db: Session) -> int:
    return session_count(db)


def recent_events(db: Session, *, limit: int) -> list[SecurityEvent]:
    return list(
        db.scalars(
            select(SecurityEvent).order_by(SecurityEvent.timestamp.desc()).limit(limit)
        )
    )


def model_event_stats(db: Session, start: datetime) -> tuple[int, int]:
    total = int(
        db.scalar(
            select(func.count(BehavioralEvent.id)).where(
                BehavioralEvent.detected_at >= start
            )
        )
        or 0
    )
    high_risk = int(
        db.scalar(
            select(func.count(BehavioralEvent.id)).where(
                BehavioralEvent.detected_at >= start,
                BehavioralEvent.risk_score >= 70,
            )
        )
        or 0
    )
    return total, high_risk


def anomaly_counts_in_range(
    db: Session, start: datetime
) -> dict[str, int]:
    return dict(
        db.execute(
            select(BehavioralEvent.identity_id, func.count(BehavioralEvent.id))
            .where(
                BehavioralEvent.detected_at >= start,
                BehavioralEvent.risk_score >= 70,
            )
            .group_by(BehavioralEvent.identity_id)
        ).all()
    )


def total_identities(db: Session) -> int:
    return int(db.scalar(select(func.count(Identity.id))) or 0)
