from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import AuthContext, require_roles
from app.core.database import get_db
from app.core.roles import ADMIN_ROLES, STAFF_ROLES
from app.domains.model.schemas import ModelEvaluationOut
from app.domains.model.service import (
    model_evaluation as model_evaluation_service,
    model_features as model_features_service,
    retrain_model as retrain_model_service,
)

router = APIRouter(prefix="/model", tags=["model"])


@router.get("/evaluation", response_model=ModelEvaluationOut)
def model_evaluation(
    auth: AuthContext = Depends(require_roles(*STAFF_ROLES)),
    db: Session = Depends(get_db),
) -> ModelEvaluationOut:
    return model_evaluation_service(db, actor=auth.identity)


@router.get("/features")
def model_features(
    auth: AuthContext = Depends(require_roles(*STAFF_ROLES)),
) -> list[dict]:
    return model_features_service()


@router.post("/retrain", response_model=ModelEvaluationOut)
def retrain_model(
    seed: int = Query(default=42, ge=1, le=100000),
    rows: int = Query(default=5000, ge=1000, le=50000),
    auth: AuthContext = Depends(require_roles(*ADMIN_ROLES)),
    db: Session = Depends(get_db),
) -> ModelEvaluationOut:
    return retrain_model_service(
        db,
        seed=seed,
        rows=rows,
        actor=auth.identity,
    )
