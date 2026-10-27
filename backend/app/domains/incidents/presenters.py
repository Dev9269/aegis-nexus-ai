from __future__ import annotations

from app.db.models import Incident
from app.domains.incidents.schemas import IncidentOut


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
