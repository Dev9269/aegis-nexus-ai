from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import AuthContext, require_roles
from app.core.database import get_db
from app.core.roles import STAFF_ROLES
from app.domains.compliance.schemas import ComplianceReport
from app.domains.compliance.service import generate_compliance_report

router = APIRouter(prefix="/compliance", tags=["compliance"])


@router.get("/report", response_model=ComplianceReport)
def compliance_report(
    framework: str = Query(default="SOC2", pattern="^(SOC2|GDPR|HIPAA)$"),
    auth: AuthContext = Depends(require_roles(*STAFF_ROLES)),
    db: Session = Depends(get_db),
) -> ComplianceReport:
    return generate_compliance_report(db, actor=auth.identity, framework=framework)
