from __future__ import annotations

from app.models import (
    AccessRequest,
    Device,
    Identity,
    Incident,
    SecurityEvent,
    BehavioralEvent,
)
from app.schemas import (
    AccessRequestDetail,
    AccessRequestOut,
    BehavioralEventOut,
    BehavioralSignalOut,
    DeviceOut,
    IdentitySummary,
    IncidentOut,
    SecurityEventOut,
)


def identity_summary(identity: Identity) -> IdentitySummary:
    return IdentitySummary.model_validate(identity)


def device_out(device: Device) -> DeviceOut:
    return DeviceOut(
        id=device.id,
        identity_id=device.identity_id,
        identity_name=device.identity.display_name if device.identity else None,
        name=device.name,
        device_type=device.device_type,
        operating_system=device.operating_system,
        state=device.state,
        enrollment_status=device.enrollment_status,
        last_observed_at=device.last_observed_at,
        enrolled_at=device.enrolled_at,
        revoked_at=device.revoked_at,
        signals=device.signals or {},
        is_simulated=device.is_simulated,
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


def event_out(event: SecurityEvent) -> SecurityEventOut:
    return SecurityEventOut.model_validate(event)
