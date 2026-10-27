from __future__ import annotations

from app.db.models import AccessRequest
from app.domains.access.schemas import AccessRequestDetail, AccessRequestOut


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
