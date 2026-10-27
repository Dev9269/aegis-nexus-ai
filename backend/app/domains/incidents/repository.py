from __future__ import annotations

from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.pagination import page_offset
from app.db.models import AccessRequest, Identity, Incident, IncidentNote, SecurityEvent


def list_incident_rows(
    db: Session, *, filters: dict[str, Any], page: int, page_size: int
) -> tuple[list[Incident], int]:
    query = (
        select(Incident)
        .outerjoin(Identity, Incident.identity_id == Identity.id)
        .order_by(Incident.created_at.desc())
    )
    count_query = select(func.count(Incident.id)).outerjoin(
        Identity, Incident.identity_id == Identity.id
    )
    conditions = []
    q = filters.get("q")
    if q:
        pattern = f"%{q.strip()}%"
        conditions.append(
            or_(
                Incident.title.ilike(pattern),
                Incident.summary.ilike(pattern),
                Incident.classification.ilike(pattern),
                Identity.display_name.ilike(pattern),
            )
        )
    status = filters.get("status")
    if status:
        conditions.append(Incident.status == status)
    severity = filters.get("severity")
    if severity:
        conditions.append(Incident.severity == severity)
    identity_id = filters.get("identity_id")
    if identity_id:
        conditions.append(Incident.identity_id == identity_id)
    assigned_to = filters.get("assigned_to")
    if assigned_to:
        conditions.append(Incident.assigned_to == assigned_to)
    if conditions:
        query = query.where(*conditions)
        count_query = count_query.where(*conditions)
    total = int(db.scalar(count_query) or 0)
    rows = list(
        db.scalars(query.offset(page_offset(page, page_size)).limit(page_size))
    )
    return rows, total


def get_incident_row(db: Session, incident_id: str) -> Incident | None:
    return db.get(Incident, incident_id)


def list_related_access(db: Session, ids: list[str]) -> list[AccessRequest]:
    if not ids:
        return []
    return list(
        db.scalars(
            select(AccessRequest)
            .where(AccessRequest.id.in_(ids))
            .order_by(AccessRequest.created_at.desc())
        )
    )


def list_incident_timeline(
    db: Session, incident_id: str, access_ids: list[str]
) -> list[SecurityEvent]:
    return list(
        db.scalars(
            select(SecurityEvent)
            .where(
                or_(
                    SecurityEvent.incident_id == incident_id,
                    SecurityEvent.access_request_id.in_(access_ids)
                    if access_ids
                    else False,
                )
            )
            .order_by(SecurityEvent.timestamp.asc())
            .limit(100)
        )
    )


def list_notes(db: Session, incident_id: str) -> list[IncidentNote]:
    return list(
        db.scalars(
            select(IncidentNote)
            .where(IncidentNote.incident_id == incident_id)
            .order_by(IncidentNote.created_at.asc())
        )
    )
