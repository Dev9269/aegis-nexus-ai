from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import AuthContext, require_roles
from app.core.database import get_db
from app.core.roles import STAFF_ROLES, WRITE_ROLES
from app.domains.response.schemas import (
    PlaybookCatalog,
    PlaybookRequest,
    PlaybookResult,
)
from app.domains.response.service import catalog, execute_playbook

router = APIRouter(prefix="/response", tags=["response"])


@router.get("/playbooks", response_model=PlaybookCatalog)
def list_playbooks(
    auth: AuthContext = Depends(require_roles(*STAFF_ROLES)),
) -> PlaybookCatalog:
    return catalog()


@router.post("/incidents/{incident_id}/actions", response_model=PlaybookResult)
def run_playbook(
    incident_id: str,
    payload: PlaybookRequest,
    auth: AuthContext = Depends(require_roles(*WRITE_ROLES)),
    db: Session = Depends(get_db),
) -> PlaybookResult:
    return execute_playbook(
        db,
        incident_id=incident_id,
        actions=payload.actions,
        reason=payload.reason.strip(),
        actor=auth.identity,
    )
