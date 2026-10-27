from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import AuthContext, require_roles
from app.api.schemas import Page
from app.audit.service import append_audit
from app.core.database import get_db
from app.core.errors import ApiError
from app.core.pagination import page_offset, page_response
from app.core.roles import STAFF_ROLES, WRITE_ROLES
from app.models import (
    AccessRequest,
    Identity,
    Incident,
    IncidentNote,
    SecurityEvent,
    new_id,
    utcnow,
)
from app.schemas import (
    IncidentDetail,
    IncidentNoteIn,
    IncidentNoteOut,
    IncidentOut,
    IncidentUpdateIn,
)
from app.serializers import access_out, event_out, incident_out
from app.services.events import record_event

router = APIRouter(prefix="/incidents", tags=["incidents"])
StatusLiteral = Literal["OPEN", "INVESTIGATING", "CONTAINED", "RESOLVED", "FALSE_POSITIVE"]
SeverityLiteral = Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]


def _get_incident(db: Session, incident_id: str) -> Incident:
    incident = db.get(Incident, incident_id)
    if incident is None:
        raise ApiError(404, "INCIDENT_NOT_FOUND", "Incident not found.")
    return incident


def _add_note(
    db: Session,
    *,
    incident: Incident,
    actor: Identity,
    note: str,
    correlation_id: str,
) -> IncidentNote:
    row = IncidentNote(
        incident_id=incident.id,
        author_id=actor.id,
        author_label=actor.display_name,
        note=note,
        created_at=utcnow(),
    )
    db.add(row)
    record_event(
        db,
        event_type="INCIDENT_NOTE_ADDED",
        category="Incident",
        summary=f"Investigation note added to {incident.title}",
        correlation_id=correlation_id,
        severity="LOW",
        identity_id=incident.identity_id,
        incident_id=incident.id,
        actor_id=actor.id,
        details={"author": actor.display_name},
        is_simulated=incident.is_simulated,
    )
    return row


@router.get("", response_model=Page[IncidentOut])
def list_incidents(
    q: str | None = Query(default=None, max_length=120),
    status: StatusLiteral | None = Query(default=None),
    severity: SeverityLiteral | None = Query(default=None),
    identity_id: str | None = Query(default=None, max_length=36),
    assigned_to: str | None = Query(default=None, max_length=36),
    page: int = Query(default=1, ge=1, le=10000),
    page_size: int = Query(default=20, ge=1, le=100),
    auth: AuthContext = Depends(require_roles(*STAFF_ROLES)),
    db: Session = Depends(get_db),
) -> Page[IncidentOut]:
    query = (
        select(Incident)
        .outerjoin(Identity, Incident.identity_id == Identity.id)
        .order_by(Incident.created_at.desc())
    )
    count_query = select(func.count(Incident.id)).outerjoin(
        Identity, Incident.identity_id == Identity.id
    )
    filters = []
    if q:
        pattern = f"%{q.strip()}%"
        filters.append(
            or_(
                Incident.title.ilike(pattern),
                Incident.summary.ilike(pattern),
                Incident.classification.ilike(pattern),
                Identity.display_name.ilike(pattern),
            )
        )
    if status:
        filters.append(Incident.status == status)
    if severity:
        filters.append(Incident.severity == severity)
    if identity_id:
        filters.append(Incident.identity_id == identity_id)
    if assigned_to:
        filters.append(Incident.assigned_to == assigned_to)
    if filters:
        query = query.where(*filters)
        count_query = count_query.where(*filters)
    total = int(db.scalar(count_query) or 0)
    rows = list(
        db.scalars(query.offset(page_offset(page, page_size)).limit(page_size))
    )
    return page_response(
        [incident_out(row) for row in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{incident_id}", response_model=IncidentDetail)
def get_incident(
    incident_id: str,
    auth: AuthContext = Depends(require_roles(*STAFF_ROLES)),
    db: Session = Depends(get_db),
) -> IncidentDetail:
    incident = _get_incident(db, incident_id)
    related_access_ids = incident.related_access_request_ids or []
    access_rows = []
    if related_access_ids:
        access_rows = list(
            db.scalars(
                select(AccessRequest)
                .where(AccessRequest.id.in_(related_access_ids))
                .order_by(AccessRequest.created_at.desc())
            )
        )
    timeline = list(
        db.scalars(
            select(SecurityEvent)
            .where(
                or_(
                    SecurityEvent.incident_id == incident.id,
                    SecurityEvent.access_request_id.in_(related_access_ids)
                    if related_access_ids
                    else False,
                )
            )
            .order_by(SecurityEvent.timestamp.asc())
            .limit(100)
        )
    )
    notes = list(
        db.scalars(
            select(IncidentNote)
            .where(IncidentNote.incident_id == incident.id)
            .order_by(IncidentNote.created_at.asc())
        )
    )
    return IncidentDetail(
        **incident_out(incident).model_dump(),
        notes=[IncidentNoteOut.model_validate(note) for note in notes],
        timeline=[event_out(event) for event in timeline],
        access_requests=[access_out(row) for row in access_rows],
    )


@router.patch("/{incident_id}", response_model=IncidentDetail)
def update_incident(
    incident_id: str,
    payload: IncidentUpdateIn,
    auth: AuthContext = Depends(require_roles(*WRITE_ROLES)),
    db: Session = Depends(get_db),
) -> IncidentDetail:
    incident = _get_incident(db, incident_id)
    if (
        payload.status is None
        and payload.severity is None
        and payload.assigned_to is None
        and payload.resolution is None
        and payload.note is None
    ):
        raise ApiError(422, "NO_CHANGES", "At least one incident field must be updated.")

    correlation_id = new_id()
    before = {
        "status": incident.status,
        "severity": incident.severity,
        "assigned_to": incident.assigned_to,
    }

    if payload.assigned_to is not None:
        assignee = db.get(Identity, payload.assigned_to)
        if assignee is None or assignee.status != "ACTIVE":
            raise ApiError(422, "INVALID_ASSIGNEE", "Assigned identity is not active or does not exist.")
        if assignee.role not in {"SECURITY_ADMIN", "SECURITY_ANALYST"}:
            raise ApiError(422, "INVALID_ASSIGNEE", "Incidents can only be assigned to security staff.")
        incident.assigned_to = assignee.id
    elif "assigned_to" in payload.model_fields_set:
        incident.assigned_to = None

    if payload.severity:
        incident.severity = payload.severity
    if payload.status:
        incident.status = payload.status
    if payload.resolution is not None:
        incident.resolution = payload.resolution
    if payload.status in {"RESOLVED", "FALSE_POSITIVE"}:
        if not (payload.resolution or incident.resolution):
            raise ApiError(
                422,
                "RESOLUTION_REQUIRED",
                "A resolution summary is required when closing an incident.",
            )

    incident.updated_at = utcnow()
    if payload.note:
        _add_note(
            db,
            incident=incident,
            actor=auth.identity,
            note=payload.note,
            correlation_id=correlation_id,
        )

    after = {
        "status": incident.status,
        "severity": incident.severity,
        "assigned_to": incident.assigned_to,
    }
    record_event(
        db,
        event_type="INCIDENT_UPDATED",
        category="Incident",
        summary=f"Incident updated: {incident.title}",
        correlation_id=correlation_id,
        severity=incident.severity,
        identity_id=incident.identity_id,
        incident_id=incident.id,
        actor_id=auth.identity.id,
        details={"before": before, "after": after},
        is_simulated=incident.is_simulated,
    )
    append_audit(
        db,
        actor=auth.identity,
        action="INCIDENT_UPDATED",
        target_type="incident",
        target_id=incident.id,
        correlation_id=correlation_id,
        result="SUCCESS",
        metadata={
            "before": before,
            "after": after,
            "resolution": payload.resolution,
            "note_added": bool(payload.note),
        },
    )
    db.commit()
    return get_incident(incident_id, auth=auth, db=db)


@router.post("/{incident_id}/notes", response_model=IncidentNoteOut)
def add_incident_note(
    incident_id: str,
    payload: IncidentNoteIn,
    auth: AuthContext = Depends(require_roles(*WRITE_ROLES)),
    db: Session = Depends(get_db),
) -> IncidentNoteOut:
    incident = _get_incident(db, incident_id)
    correlation_id = new_id()
    note = _add_note(
        db,
        incident=incident,
        actor=auth.identity,
        note=payload.note,
        correlation_id=correlation_id,
    )
    incident.updated_at = utcnow()
    append_audit(
        db,
        actor=auth.identity,
        action="INCIDENT_NOTE_ADDED",
        target_type="incident",
        target_id=incident.id,
        correlation_id=correlation_id,
        result="SUCCESS",
        metadata={"note_length": len(payload.note)},
    )
    db.commit()
    db.refresh(note)
    return IncidentNoteOut.model_validate(note)
