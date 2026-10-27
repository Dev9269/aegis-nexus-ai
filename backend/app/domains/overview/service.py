from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.core.time import as_utc
from app.db.models import utcnow
from app.domains.events.presenters import event_out
from app.domains.overview import repository
from app.domains.overview.schemas import (
    NamedCount,
    OverviewMetrics,
    OverviewOut,
    RiskLeader,
    TimelinePoint,
)
from app.domains.system.service import build_health_status
from app.ml.runtime import get_metadata, model_available

VALID_RANGE_HOURS = {1, 6, 24, 72, 168}


def _bucket_minutes(hours: int) -> int:
    if hours <= 6:
        return 30
    if hours <= 24:
        return 60
    if hours <= 72:
        return 180
    return 360


def _range_label(hours: int) -> str:
    return {
        1: "Last hour",
        6: "Last 6 hours",
        24: "Last 24 hours",
        72: "Last 3 days",
        168: "Last 7 days",
    }[hours]


def _floor_epoch(epoch: float, bucket_seconds: int) -> int:
    return int(epoch // bucket_seconds) * bucket_seconds


def get_overview(db: Session, *, range_hours: int) -> OverviewOut:
    if range_hours not in VALID_RANGE_HOURS:
        raise ApiError(
            422,
            "INVALID_RANGE",
            f"range_hours must be one of {sorted(VALID_RANGE_HOURS)}.",
        )
    now = utcnow()
    start = now - timedelta(hours=range_hours)
    bucket_seconds = _bucket_minutes(range_hours) * 60
    bucket_start_epoch = _floor_epoch(start.timestamp(), bucket_seconds)
    bucket_count = int((now.timestamp() - bucket_start_epoch) // bucket_seconds) + 1
    buckets = [
        {
            "timestamp": bucket_start_epoch + index * bucket_seconds,
            "access_requests": 0,
            "security_events": 0,
            "high_risk": 0,
        }
        for index in range(bucket_count)
    ]

    access_rows = repository.access_requests_in_range(db, start, now)
    decision_counts = Counter(row.decision for row in access_rows)
    risk_counts = Counter(row.risk_category for row in access_rows)
    high_risk_requests = sum(
        1 for row in access_rows if row.risk_category in {"HIGH", "CRITICAL"}
    )
    for row in access_rows:
        created = as_utc(row.created_at)
        if created is None:
            continue
        index = int((created.timestamp() - bucket_start_epoch) // bucket_seconds)
        if 0 <= index < len(buckets):
            buckets[index]["access_requests"] += 1
            if row.risk_category in {"HIGH", "CRITICAL"}:
                buckets[index]["high_risk"] += 1

    event_rows = repository.events_in_range(db, start, now)
    for event in event_rows:
        timestamp = as_utc(event.timestamp)
        if timestamp is None:
            continue
        index = int((timestamp.timestamp() - bucket_start_epoch) // bucket_seconds)
        if 0 <= index < len(buckets):
            buckets[index]["security_events"] += 1

    model_event_count, model_high_risk = repository.model_event_stats(db, start)
    demo_events = sum(1 for event in event_rows if event.is_simulated)
    real_events = len(event_rows) - demo_events
    suspicious_events = sum(
        1 for event in event_rows if event.severity in {"HIGH", "CRITICAL"}
    )

    if model_available():
        model_version = get_metadata().get("model_version", "unknown")
    else:
        model_version = "not_trained"

    metrics = OverviewMetrics(
        total_identities=repository.total_identities(db),
        active_sessions=repository.active_session_count(db),
        access_requests=len(access_rows),
        suspicious_events=suspicious_events,
        high_risk_requests=high_risk_requests,
        denied_requests=decision_counts.get("DENY", 0),
        challenged_requests=decision_counts.get("CHALLENGE", 0),
        model_analyzed_events=model_event_count,
        model_anomaly_rate=round(
            (model_high_risk / model_event_count * 100) if model_event_count else 0.0, 1
        ),
        model_version=model_version,
        demo_events=demo_events,
        real_events=real_events,
    )

    anomaly_counts = repository.anomaly_counts_in_range(db, start)
    leaders = repository.identities_in_range(db)[:5]
    recent = repository.recent_events(db, limit=8)

    timeline = [
        TimelinePoint(
            bucket=datetime.fromtimestamp(bucket["timestamp"], tz=timezone.utc).isoformat(),
            access_requests=bucket["access_requests"],
            security_events=bucket["security_events"],
            high_risk=bucket["high_risk"],
        )
        for bucket in buckets
    ]

    return OverviewOut(
        range_hours=range_hours,
        range_label=_range_label(range_hours),
        generated_at=now,
        metrics=metrics,
        timeline=timeline,
        risk_distribution=[
            NamedCount(name=name, value=risk_counts.get(name, 0))
            for name in ("LOW", "MEDIUM", "HIGH", "CRITICAL")
        ],
        decision_breakdown=[
            NamedCount(name=name, value=decision_counts.get(name, 0))
            for name in ("ALLOW", "CHALLENGE", "RESTRICT", "DENY")
        ],
        identity_leaderboard=[
            RiskLeader(
                identity_id=identity.id,
                identity_name=identity.display_name,
                role=identity.role,
                risk_score=identity.current_risk,
                anomaly_count=int(anomaly_counts.get(identity.id, 0)),
            )
            for identity in leaders
        ],
        recent_events=[event_out(event) for event in recent],
        health=build_health_status(),
    )
