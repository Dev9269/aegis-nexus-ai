from __future__ import annotations

from fastapi import APIRouter

from app.domains.access.router import router as access_router
from app.domains.audit.router import router as audit_router
from app.domains.auth.router import router as auth_router
from app.domains.demo.router import router as demo_router
from app.domains.devices.router import router as devices_router
from app.domains.events.router import router as events_router
from app.domains.identities.router import router as identities_router
from app.domains.incidents.router import router as incidents_router
from app.domains.model.router import router as model_router
from app.domains.overview.router import router as overview_router
from app.domains.policies.router import router as policies_router
from app.domains.system.router import router as system_router

router = APIRouter()
for child in (
    system_router,
    auth_router,
    identities_router,
    devices_router,
    access_router,
    policies_router,
    events_router,
    incidents_router,
    overview_router,
    model_router,
    audit_router,
    demo_router,
):
    router.include_router(child, prefix="/api")
