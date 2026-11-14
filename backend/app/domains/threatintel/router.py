from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import AuthContext, require_roles
from app.core.database import get_db
from app.core.roles import STAFF_ROLES, WRITE_ROLES
from app.domains.threatintel.schemas import (
    LeakFindingOut,
    LeakFindingUpdate,
    SimulateLeakOut,
    ThreatIntelSummary,
)
from app.domains.threatintel.service import (
    get_summary,
    list_findings,
    simulate_leak,
    update_finding,
)

router = APIRouter(prefix="/threat-intel", tags=["threat-intel"])


@router.get("/findings", response_model=list[LeakFindingOut])
def list_leak_findings(
    status: str | None = Query(default=None),
    severity: str | None = Query(default=None),
    identity_id: str | None = Query(default=None, max_length=36),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    auth: AuthContext = Depends(require_roles(*STAFF_ROLES)),
    db: Session = Depends(get_db),
) -> list[LeakFindingOut]:
    return list_findings(db, status=status, severity=severity, identity_id=identity_id, page=page, page_size=page_size)


@router.get("/summary", response_model=ThreatIntelSummary)
def threat_intel_summary(
    auth: AuthContext = Depends(require_roles(*STAFF_ROLES)),
    db: Session = Depends(get_db),
) -> ThreatIntelSummary:
    return get_summary(db)


@router.post("/simulate", response_model=SimulateLeakOut)
def simulate_leak_finding(
    identity_id: str | None = Query(default=None, max_length=36),
    auth: AuthContext = Depends(require_roles(*WRITE_ROLES)),
    db: Session = Depends(get_db),
) -> SimulateLeakOut:
    try:
        return simulate_leak(db, actor=auth.identity, identity_id=identity_id)
    except ValueError as exc:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=str(exc))


@router.patch("/findings/{finding_id}", response_model=LeakFindingOut)
def update_leak_finding(
    finding_id: str,
    payload: LeakFindingUpdate,
    auth: AuthContext = Depends(require_roles(*WRITE_ROLES)),
    db: Session = Depends(get_db),
) -> LeakFindingOut:
    try:
        return update_finding(db, finding_id=finding_id, status=payload.status, actor=auth.identity)
    except ValueError as exc:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=str(exc))