from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import AuthContext, require_roles
from app.core.database import get_db
from app.core.roles import STAFF_ROLES
from app.domains.overview.schemas import OverviewOut
from app.domains.overview.service import get_overview as get_overview_service

router = APIRouter(tags=["overview"])


@router.get("/overview", response_model=OverviewOut)
def get_overview(
    range_hours: int = Query(default=24),
    auth: AuthContext = Depends(require_roles(*STAFF_ROLES)),
    db: Session = Depends(get_db),
) -> OverviewOut:
    return get_overview_service(db, range_hours=range_hours)
