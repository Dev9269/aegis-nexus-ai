from __future__ import annotations

from app.db.models import BehavioralEvent, Identity
from app.domains.identities.schemas import BehavioralSignalOut, IdentitySummary


def identity_summary(identity: Identity) -> IdentitySummary:
    return IdentitySummary.model_validate(identity)


def behavioral_signal_out(event: BehavioralEvent) -> BehavioralSignalOut:
    return BehavioralSignalOut(
        id=event.id,
        detected_at=event.detected_at,
        risk_score=event.risk_score,
        risk_category=event.risk_category,
        model_version=event.model_version,
        top_factors=(event.feature_summary or [])[:3],
        is_simulated=event.is_simulated,
    )
