from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import AuthContext, require_roles
from app.core.database import get_db
from app.core.roles import STAFF_ROLES
from app.domains.security.schemas import AuthenticationPosture, EncryptionPosture
from app.domains.security.service import (
    get_authentication_posture,
    get_encryption_posture,
)

router = APIRouter(prefix="/security", tags=["security"])


@router.get("/encryption", response_model=EncryptionPosture)
def encryption_posture(
    auth: AuthContext = Depends(require_roles(*STAFF_ROLES)),
    db: Session = Depends(get_db),
) -> EncryptionPosture:
    return get_encryption_posture(db)


@router.get("/authentication", response_model=AuthenticationPosture)
def authentication_posture(
    auth: AuthContext = Depends(require_roles(*STAFF_ROLES)),
    db: Session = Depends(get_db),
) -> AuthenticationPosture:
    return get_authentication_posture(db, identity=auth.identity, session=auth.session)
