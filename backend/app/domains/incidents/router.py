from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import AuthContext, require_roles
from app.api.schemas import Page
from app.core.database import get_db
from app.core.roles import STAFF_ROLES, WRITE_ROLES
from app.domains.incidents.schemas import (
    IncidentDetail,
    IncidentNoteIn,
    IncidentNoteOut,
    IncidentOut,
    IncidentUpdateIn,
)
from app.domains.incidents.service import (
    add_incident_note as add_incident_note_service,
    get_incident as get_incident_service,
    list_incidents as list_incidents_service,
    update_incident as update_incident_service,
)

router = APIRouter(prefix="/incidents", tags=["incidents"])
StatusLiteral = Literal["OPEN", "INVESTIGATING", "CONTAINED", "RESOLVED", "FALSE_POSITIVE"]
SeverityLiteral = Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]


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
    return list_incidents_service(
        db,
        filters={
            "q": q,
            "status": status,
            "severity": severity,
            "identity_id": identity_id,
            "assigned_to": assigned_to,
        },
        page=page,
        page_size=page_size,
    )


@router.get("/{incident_id}", response_model=IncidentDetail)
def get_incident(
    incident_id: str,
    auth: AuthContext = Depends(require_roles(*STAFF_ROLES)),
    db: Session = Depends(get_db),
) -> IncidentDetail:
    return get_incident_service(db, incident_id)


@router.patch("/{incident_id}", response_model=IncidentDetail)
def update_incident(
    incident_id: str,
    payload: IncidentUpdateIn,
    auth: AuthContext = Depends(require_roles(*WRITE_ROLES)),
    db: Session = Depends(get_db),
) -> IncidentDetail:
    return update_incident_service(
        db,
        incident_id=incident_id,
        payload=payload,
        actor=auth.identity,
    )


@router.post("/{incident_id}/notes", response_model=IncidentNoteOut)
def add_incident_note(
    incident_id: str,
    payload: IncidentNoteIn,
    auth: AuthContext = Depends(require_roles(*WRITE_ROLES)),
    db: Session = Depends(get_db),
) -> IncidentNoteOut:
    return add_incident_note_service(
        db,
        incident_id=incident_id,
        payload=payload,
        actor=auth.identity,
    )
