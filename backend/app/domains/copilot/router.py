from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import AuthContext, require_roles
from app.core.database import get_db
from app.core.roles import STAFF_ROLES
from app.domains.copilot.schemas import CopilotAnswer, CopilotQuestion
from app.domains.copilot.service import ask

router = APIRouter(prefix="/copilot", tags=["copilot"])


@router.post("/ask", response_model=CopilotAnswer)
def ask_copilot(
    payload: CopilotQuestion,
    auth: AuthContext = Depends(require_roles(*STAFF_ROLES)),
    db: Session = Depends(get_db),
) -> CopilotAnswer:
    return ask(db, question=payload.question)
