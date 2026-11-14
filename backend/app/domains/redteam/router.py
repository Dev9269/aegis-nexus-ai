from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import AuthContext, require_roles
from app.core.database import get_db
from app.core.roles import STAFF_ROLES, WRITE_ROLES
from app.domains.redteam.schemas import (
    RedTeamRunOut,
    RedTeamScenario,
)
from app.domains.redteam.service import list_scenarios, run_red_team

router = APIRouter(prefix="/red-team", tags=["red-team"])


@router.get("/scenarios", response_model=list[RedTeamScenario])
def get_red_team_scenarios(
    auth: AuthContext = Depends(require_roles(*STAFF_ROLES)),
) -> list[RedTeamScenario]:
    return list_scenarios()


@router.post("/run", response_model=RedTeamRunOut)
def run_red_team_endpoint(
    scenario: str | None = Query(default=None, max_length=60),
    auth: AuthContext = Depends(require_roles(*WRITE_ROLES)),
    db: Session = Depends(get_db),
) -> RedTeamRunOut:
    return run_red_team(db, actor=auth.identity, scenario_id=scenario)