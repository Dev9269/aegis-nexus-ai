from __future__ import annotations

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.api.deps import AuthContext, require_roles
from app.core.database import get_db
from app.core.roles import STAFF_ROLES
from app.domains.reports.schemas import ExecutiveReport
from app.domains.reports.service import build_executive_report, render_executive_pdf

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/executive", response_model=ExecutiveReport)
def executive_report(
    auth: AuthContext = Depends(require_roles(*STAFF_ROLES)),
    db: Session = Depends(get_db),
) -> ExecutiveReport:
    return build_executive_report(db)


@router.get("/executive.pdf")
def executive_report_pdf(
    auth: AuthContext = Depends(require_roles(*STAFF_ROLES)),
    db: Session = Depends(get_db),
) -> Response:
    report = build_executive_report(db)
    pdf = render_executive_pdf(report)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'attachment; filename="aegis-executive-report.pdf"'
        },
    )
