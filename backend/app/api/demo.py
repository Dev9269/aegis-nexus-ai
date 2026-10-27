from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import AuthContext, require_roles
from app.core.config import get_settings
from app.core.database import get_db
from app.core.errors import ApiError
from app.core.roles import ADMIN_ROLES, STAFF_ROLES, WRITE_ROLES
from app.schemas import DemoResetOut, DemoRunOut, DemoScenarioInfo
from app.services.demo import list_demo_scenarios, reset_demo_data, run_demo_scenarios

router = APIRouter(prefix="/demo", tags=["demo"])
ScenarioId = Literal["A", "B", "C", "D", "E", "F"]


def _require_demo_mode() -> None:
    if not get_settings().demo_mode:
        raise ApiError(
            403,
            "DEMO_MODE_DISABLED",
            "Demo endpoints are only available when demo mode is enabled.",
        )


@router.get("/scenarios", response_model=list[DemoScenarioInfo])
def get_demo_scenarios(
    auth: AuthContext = Depends(require_roles(*STAFF_ROLES)),
) -> list[DemoScenarioInfo]:
    _require_demo_mode()
    return list_demo_scenarios()


@router.post("/scenarios/{scenario}", response_model=DemoRunOut)
def run_demo_scenario(
    scenario: ScenarioId,
    auth: AuthContext = Depends(require_roles(*WRITE_ROLES)),
    db: Session = Depends(get_db),
) -> DemoRunOut:
    _require_demo_mode()
    try:
        result = run_demo_scenarios(db, actor=auth.identity, scenario=scenario)
    except FileNotFoundError as exc:
        db.rollback()
        raise ApiError(
            503,
            "MODEL_UNAVAILABLE",
            "The anomaly detection model is unavailable. Train the model before running demos.",
        ) from exc
    db.commit()
    return result


@router.post("/run", response_model=DemoRunOut)
def run_all_demo_scenarios(
    auth: AuthContext = Depends(require_roles(*WRITE_ROLES)),
    db: Session = Depends(get_db),
) -> DemoRunOut:
    _require_demo_mode()
    try:
        result = run_demo_scenarios(db, actor=auth.identity)
    except FileNotFoundError as exc:
        db.rollback()
        raise ApiError(
            503,
            "MODEL_UNAVAILABLE",
            "The anomaly detection model is unavailable. Train the model before running demos.",
        ) from exc
    db.commit()
    return result


@router.post("/reset", response_model=DemoResetOut)
def reset_demo(
    auth: AuthContext = Depends(require_roles(*ADMIN_ROLES)),
    db: Session = Depends(get_db),
) -> DemoResetOut:
    _require_demo_mode()
    return reset_demo_data(db)
