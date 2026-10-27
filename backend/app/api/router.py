from __future__ import annotations

from fastapi import APIRouter

from app.api import (
    access,
    audit,
    demo,
    devices,
    events,
    identities,
    incidents,
    model,
    overview,
    policies,
)
from app.domains.auth.router import router as auth_router
from app.domains.system.router import router as system_router

router = APIRouter()
for child in (
    system_router,
    auth_router,
    identities.router,
    devices.router,
    access.router,
    policies.router,
    events.router,
    incidents.router,
    overview.router,
    model.router,
    audit.router,
    demo.router,
):
    router.include_router(child, prefix="/api")

