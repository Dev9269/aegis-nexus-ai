from __future__ import annotations

from app.domains.devices.presenters import device_out  # noqa: F401  # TEMP-COMPAT
from app.domains.events.presenters import event_out  # noqa: F401  # TEMP-COMPAT
from app.domains.identities.presenters import (  # noqa: F401  # TEMP-COMPAT
    behavioral_signal_out,
    identity_summary,
)
from app.models import (
    AccessRequest,
    Incident,
    BehavioralEvent,
)
from app.schemas import (
    AccessRequestDetail,
    AccessRequestOut,
    BehavioralEventOut,
    IncidentOut,
)


def access_out(request: AccessRequest) -> AccessRequestOut:
    return AccessRequestOut(
        id=request.id,
        identity_id=request.identity_id,
        identity_name=request.identity.display_name if request.identity else "Unknown identity",
        identity_email=request.identity.email if request.identity else "",
        resource_id=request.resource_id,
        resource_name=request.resource.name if request.resource else "Unknown resource",
        resource_key=request.resource.key if request.resource else "",
        device_id=request.device_id,
        device_name=request.device.name if request.device else None,
        requested_action=request.requested_action,
        decision=request.decision,
        risk_score=request.risk_score,
        risk_category=request.risk_category,
        anomaly_score=request.anomaly_score,
        policy_version=request.policy_version,
        recommended_action=request.recommended_action,
        created_at=request.created_at,
        is_simulated=request.is_simulated,
    )


def access_detail(request: AccessRequest) -> AccessRequestDetail:
    base = access_out(request).model_dump()
    behavior = request.behavioral_event
    return AccessRequestDetail(
        **base,
        reasons=request.reasons or [],
        correlation_id=request.correlation_id,
        model_version=behavior.model_version if behavior else None,
        feature_summary=behavior.feature_summary if behavior else [],
        features=behavior.features if behavior else {},
    )


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


def incident_out(incident: Incident) -> IncidentOut:
    return IncidentOut(
        id=incident.id,
        title=incident.title,
        classification=incident.classification,
        severity=incident.severity,
        status=incident.status,
        identity_id=incident.identity_id,
        identity_name=incident.identity.display_name if incident.identity else None,
        summary=incident.summary,
        assigned_to=incident.assigned_to,
        related_access_request_ids=incident.related_access_request_ids or [],
        related_device_ids=incident.related_device_ids or [],
        resolution=incident.resolution,
        created_at=incident.created_at,
        updated_at=incident.updated_at,
        is_simulated=incident.is_simulated,
    )
