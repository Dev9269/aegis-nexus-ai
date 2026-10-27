from __future__ import annotations

from app.domains.access.presenters import access_detail, access_out  # noqa: F401  # TEMP-COMPAT
from app.domains.devices.presenters import device_out  # noqa: F401  # TEMP-COMPAT
from app.domains.events.presenters import event_out  # noqa: F401  # TEMP-COMPAT
from app.domains.identities.presenters import (  # noqa: F401  # TEMP-COMPAT
    behavioral_signal_out,
    identity_summary,
)
from app.domains.incidents.presenters import incident_out  # noqa: F401  # TEMP-COMPAT
from app.db.models import BehavioralEvent
from app.schemas import BehavioralEventOut


def behavioral_event_out(event: BehavioralEvent) -> BehavioralEventOut:
    return BehavioralEventOut(
        id=event.id,
        identity_id=event.identity_id,
        identity_name=event.identity.display_name if event.identity else None,
        device_id=event.device_id,
        features=event.features or {},
        anomaly_score=event.anomaly_score,
        risk_score=event.risk_score,
        risk_category=event.risk_category,
        feature_summary=event.feature_summary or [],
        model_version=event.model_version,
        detected_at=event.detected_at,
        is_simulated=event.is_simulated,
    )
