# AEGIS NEXUS AI Modular Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize AEGIS into feature-first frontend modules and layered backend domains with identical external behavior.

**Architecture:** Incremental strangler refactor inside the existing modular monolith. Backend routers call services; services own domain rules and transactions; repositories own SQL. Frontend pages compose feature hooks and components; TanStack Query owns server state and small Zustand stores own cross-route client state.

**Tech Stack:** FastAPI, SQLAlchemy 2.0.36, Pydantic v2, Alembic, SQLite, React 18, TypeScript 5.6, Vite 8, TanStack Query 5, React Router 7, Vitest, Playwright, Zustand, `openapi-typescript`.

**Spec:** `docs/superpowers/specs/2026-10-27-aegis-refactor-design.md`

## Global Constraints

- Preserve `/api/*` paths, methods, status codes, operation IDs, response models, and `{"error": {"code", "message", "details"}}`.
- Preserve `aegis_session` HttpOnly, `aegis_csrf` readable, and `X-CSRF-Token` double-submit behavior.
- Preserve roles exactly: `SECURITY_ADMIN`, `SECURITY_ANALYST`, `EMPLOYEE`, `AUDITOR`.
- Preserve mandatory policy denial precedence, ML escalation-only behavior, audit-chain semantics, CSV caps/headers/filenames, and demo reset behavior.
- Preserve every SPA route and demo flow.
- Preserve all `AEGIS_*` names and defaults. Never expose a secret through `VITE_*`.
- Keep `SQLAlchemy==2.0.36`.
- Do not add API versioning or new endpoints.
- Do not remove code without import, build, test, and contract evidence.
- Docker/PostgreSQL remains unverified unless run on a Docker host.
- Baseline already committed: `b0e25fd`; backend `79 passed`, frontend `20 passed`, Playwright `3 passed`.
- Run commands from the repository root unless a step says `backend/` or `frontend/`.

## File Structure

### Backend

```text
backend/app/
  main.py
  api/{router.py,deps.py,schemas.py}
  core/{config/,database.py,errors.py,logging.py,pagination.py,roles.py,time.py,csv.py}
  db/models.py
  domains/{auth,identities,devices,access,policies,incidents,events,overview,model,audit,demo,system}/
    {__init__.py,router.py,schemas.py,service.py,repository.py,presenters.py}
  security/{passwords.py,sessions.py,tokens.py,csrf.py}
  ml/{features.py,scoring.py,runtime.py}
  realtime/__init__.py
  seed/{__init__.py,demo.py,bootstrap.py}
```

### Frontend

```text
frontend/src/
  app/{App.tsx,router.tsx,providers.tsx,query-client.ts,error-boundary.tsx,realtime.ts,useRealtime.ts}
  app/layout/{AppShell.tsx,Sidebar.tsx,Topbar.tsx,CommandPalette.tsx}
  config/env.ts
  components/{ui/,layout/BrandMark.tsx,charts/}
  features/
    auth/{api.ts,queries.ts,store.ts,pages/,components/}
    access/{api.ts,queries.ts,model.ts,pages/,components/}
    identities/{api.ts,queries.ts,model.ts,pages/,components/}
    devices/{api.ts,queries.ts,model.ts,pages/,components/}
    incidents/{api.ts,queries.ts,model.ts,pages/,components/}
    events/{api.ts,queries.ts,model.ts,pages/,components/}
    policies/{api.ts,queries.ts,model.ts,pages/,components/}
    audit/{api.ts,queries.ts,model.ts,pages/,components/}
    model/{api.ts,queries.ts,pages/,components/}
    overview/{api.ts,queries.ts,model.ts,pages/,components/}
    demo/{api.ts,queries.ts,pages/,components/}
    settings/{api.ts,queries.ts,pages/,components/}
    employee/{api.ts,queries.ts,model.ts,pages/,components/}
    toast/{store.ts,Toaster.tsx}
    preferences/{store.ts,useTheme.ts}
  lib/{http.ts,utils.ts,constants.ts,features.ts,navigation.ts,storage.ts}
  types/{api.ts,generated/openapi.d.ts}
```

### Task 0: Verify the safety baseline

**Files:** None.

**Interfaces:**
- Consumes: committed baseline `b0e25fd`.
- Produces: verified starting state before any refactor commit.

- [ ] **Step 0: Commit the plan itself**

```bash
git add docs/superpowers/plans/2026-10-27-aegis-modular-refactor.md
git commit -m "docs: add modular refactor implementation plan"
```

- [ ] **Step 1: Verify git state**

Run: `git status --short`
Expected: no output.

- [ ] **Step 2: Verify backend baseline**

Run from `backend/`: `.\.venv\Scripts\python.exe -m pytest -q`
Expected: `79 passed`.

- [ ] **Step 3: Verify frontend baseline**

Run from `frontend/`: `npm run test`
Expected: `20 passed`.

- [ ] **Step 4: Record any mismatch**

If counts differ, update this plan’s baseline line before continuing. Do not refactor against an unverified baseline.

### Task 1: Add the API contract guard

**Files:**
- Create: `backend/scripts/export_openapi.py`
- Create: `backend/tests/test_openapi_contract.py`
- Create: `frontend/openapi.json`

**Interfaces:**
- Consumes: `app.main.app`.
- Produces: deterministic OpenAPI snapshot and exact path/method/operation-ID allowlist.

- [ ] **Step 1: Write the failing contract test**

```python
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EXPECTED = {
    "/api": {"get": "api_root_api_get"},
    "/api/health": {"get": "health_api_health_get"},
    "/api/health/ready": {"get": "readiness_api_health_ready_get"},
    "/api/health/detailed": {"get": "detailed_health_api_health_detailed_get"},
    "/api/auth/login": {"post": "login_api_auth_login_post"},
    "/api/auth/me": {"get": "me_api_auth_me_get"},
    "/api/auth/logout": {"post": "logout_api_auth_logout_post"},
    "/api/identities": {"get": "list_identities_api_identities_get"},
    "/api/identities/{identity_id}": {"get": "get_identity_api_identities__identity_id__get"},
    "/api/devices": {
        "get": "list_devices_api_devices_get",
        "post": "enroll_device_api_devices_post",
    },
    "/api/devices/{device_id}/state": {
        "patch": "update_device_state_api_devices__device_id__state_patch"
    },
    "/api/access-requests": {"get": "list_access_requests_api_access_requests_get"},
    "/api/access-requests/export.csv": {
        "get": "export_access_requests_api_access_requests_export_csv_get"
    },
    "/api/access-requests/evaluate": {
        "post": "evaluate_access_request_api_access_requests_evaluate_post"
    },
    "/api/access-requests/{request_id}": {
        "get": "get_access_request_api_access_requests__request_id__get"
    },
    "/api/resources": {"get": "list_resources_api_resources_get"},
    "/api/resources/{resource_id}": {"get": "get_resource_api_resources__resource_id__get"},
    "/api/resources/{resource_id}/policies": {
        "get": "get_policy_history_api_resources__resource_id__policies_get"
    },
    "/api/resources/{resource_id}/policy": {
        "put": "update_policy_api_resources__resource_id__policy_put"
    },
    "/api/policies/preview": {"post": "preview_policy_api_policies_preview_post"},
    "/api/events": {"get": "list_events_api_events_get"},
    "/api/events/{event_id}": {"get": "get_event_api_events__event_id__get"},
    "/api/notifications": {"get": "list_notifications_api_notifications_get"},
    "/api/incidents": {"get": "list_incidents_api_incidents_get"},
    "/api/incidents/{incident_id}": {
        "get": "get_incident_api_incidents__incident_id__get",
        "patch": "update_incident_api_incidents__incident_id__patch",
    },
    "/api/incidents/{incident_id}/notes": {
        "post": "add_incident_note_api_incidents__incident_id__notes_post"
    },
    "/api/overview": {"get": "get_overview_api_overview_get"},
    "/api/model/evaluation": {"get": "model_evaluation_api_model_evaluation_get"},
    "/api/model/features": {"get": "model_features_api_model_features_get"},
    "/api/model/retrain": {"post": "retrain_model_api_model_retrain_post"},
    "/api/audit": {"get": "list_audit_api_audit_get"},
    "/api/audit/verify": {"get": "verify_chain_api_audit_verify_get"},
    "/api/audit/export.csv": {"get": "export_audit_api_audit_export_csv_get"},
    "/api/settings/info": {"get": "settings_info_api_settings_info_get"},
    "/api/demo/scenarios": {"get": "get_demo_scenarios_api_demo_scenarios_get"},
    "/api/demo/scenarios/{scenario}": {
        "post": "run_demo_scenario_api_demo_scenarios__scenario__post"
    },
    "/api/demo/run": {"post": "run_all_demo_scenarios_api_demo_run_post"},
    "/api/demo/reset": {"post": "reset_demo_api_demo_reset_post"},
}


def test_openapi_paths_and_operation_ids_are_stable(client):
    schema = client.app.openapi()
    actual = {
        path: {method: operation["operationId"] for method, operation in methods.items()}
        for path, methods in schema["paths"].items()
    }
    assert actual == EXPECTED


def test_committed_openapi_matches_live_application(client):
    committed = json.loads((ROOT / "frontend" / "openapi.json").read_text(encoding="utf-8"))
    assert committed == json.loads(json.dumps(client.app.openapi()))
```

- [ ] **Step 2: Run the test to verify it fails**

Run from `backend/`: `.\.venv\Scripts\python.exe -m pytest tests\test_openapi_contract.py -q`
Expected: FAIL because `frontend/openapi.json` does not exist.

- [ ] **Step 3: Add the exporter**

```python
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app.main import app  # noqa: E402

OUTPUT = ROOT / "frontend" / "openapi.json"


def main() -> None:
    OUTPUT.write_text(
        json.dumps(app.openapi(), indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Generate and verify the snapshot**

Run: `backend\.venv\Scripts\python.exe backend\scripts\export_openapi.py`
Run from `backend/`: `.\.venv\Scripts\python.exe -m pytest tests\test_openapi_contract.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/export_openapi.py backend/tests/test_openapi_contract.py frontend/openapi.json
git commit -m "test: lock API paths and operation ids"
```

### Task 2: Generate frontend wire types and drift checks

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/scripts/check-openapi-types.mjs`
- Create: `frontend/src/types/generated/openapi.d.ts`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `frontend/openapi.json`.
- Produces: `npm run api:types`, `npm run api:check`, and generated `components["schemas"]` types.

- [ ] **Step 1: Install the generator**

Run from `frontend/`: `npm install --save-dev openapi-typescript`
Expected: `package.json` and `package-lock.json` updated.

- [ ] **Step 2: Add scripts**

```json
{
  "scripts": {
    "api:types": "openapi-typescript openapi.json -o src/types/generated/openapi.d.ts",
    "api:check": "node scripts/check-openapi-types.mjs"
  }
}
```

Keep the existing scripts unchanged.

- [ ] **Step 3: Add the drift checker**

```javascript
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tempDir = mkdtempSync(join(tmpdir(), "aegis-openapi-"));
const tempFile = join(tempDir, "openapi.d.ts");

try {
  execFileSync("npx", ["openapi-typescript", "openapi.json", "-o", tempFile], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  const committed = readFileSync("src/types/generated/openapi.d.ts", "utf8");
  const generated = readFileSync(tempFile, "utf8");
  if (committed !== generated) {
    console.error("Generated OpenAPI types are stale. Run npm run api:types.");
    process.exitCode = 1;
  }
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
```

- [ ] **Step 4: Generate and verify**

Run from `frontend/`: `npm run api:types`
Run from `frontend/`: `npm run api:check`
Expected: both pass with no diff.

- [ ] **Step 5: Add CI checks**

In the frontend CI job after `npm ci`, add:

```yaml
      - name: Check generated API types
        run: npm run api:check
```

- [ ] **Step 6: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/scripts/check-openapi-types.mjs frontend/src/types/generated/openapi.d.ts .github/workflows/ci.yml
git commit -m "build: generate frontend types from OpenAPI"
```

### Task 3: Add remaining characterization tests

**Files:**
- Create: `backend/tests/test_contract_characterization.py`

**Interfaces:**
- Consumes: existing `client`, `make_identity`, `login`, and `csrf_headers`.
- Produces: role-boundary and error-envelope locks.

- [ ] **Step 1: Write the failing characterization tests**

```python
from __future__ import annotations

from tests.conftest import login


def test_unknown_route_keeps_starlette_404_shape(client):
    response = client.get("/api/not-a-real-route")
    assert response.status_code == 404
    assert response.json() == {"detail": "Not Found"}


def test_unauthenticated_known_route_uses_error_envelope(client):
    response = client.get("/api/auth/me")
    assert response.status_code == 401
    assert response.json() == {
        "error": {
            "code": "NOT_AUTHENTICATED",
            "message": "Authentication is required.",
            "details": None,
        }
    }


def test_employee_cannot_read_staff_surfaces(client, employee_identity):
    login(client, employee_identity.email)
    assert client.get("/api/audit").status_code == 403
    assert client.get("/api/incidents").status_code == 403


def test_auditor_cannot_evaluate_access(client, auditor_identity):
    csrf = login(client, auditor_identity.email)
    response = client.post(
        "/api/access-requests/evaluate",
        headers={"X-CSRF-Token": csrf},
        json={
            "identity_id": auditor_identity.id,
            "resource_id": "missing-resource",
            "requested_action": "READ",
            "features": {
                "login_hour": 9,
                "day_of_week": 1,
                "failed_logins_15m": 0,
                "requests_1h": 1,
                "distinct_resources_1h": 1,
                "sensitive_access_ratio": 0,
                "new_device": False,
                "geo_novelty": False,
                "session_duration_min": 10,
                "activity_deviation": 0,
            },
        },
    )
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "FORBIDDEN"
```

- [ ] **Step 2: Run the tests**

Run from `backend/`: `.\.venv\Scripts\python.exe -m pytest tests\test_contract_characterization.py -q`
Expected: PASS. These tests freeze current behavior before structural moves.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_contract_characterization.py
git commit -m "test: characterize role and error boundaries"
```

### Task 4: Add backend shared foundations

**Files:**
- Create: `backend/app/core/roles.py`
- Create: `backend/app/core/pagination.py`
- Create: `backend/app/core/csv.py`
- Create: `backend/app/api/schemas.py`
- Modify: `backend/app/core/errors.py`
- Modify: `backend/app/core/time.py`
- Modify: `backend/app/api/access.py`
- Modify: `backend/app/api/audit.py`
- Modify: `backend/app/api/events.py`
- Modify: `backend/app/api/identities.py`
- Modify: `backend/app/api/devices.py`
- Modify: `backend/app/api/incidents.py`
- Modify: `backend/app/api/policies.py`
- Modify: `backend/app/api/demo.py`
- Modify: `backend/app/api/model.py`
- Modify: `backend/app/api/health.py`
- Modify: `backend/app/api/settings.py`
- Create: `backend/tests/test_shared_helpers.py`

**Interfaces:**
- Consumes: current `Page`, time parsing, CSV escaping, and role constants.
- Produces: `STAFF_ROLES`, `WRITE_ROLES`, `ADMIN_ROLES`, `Page`, `page_offset`, `page_response`, `csv_safe`, `csv_download`, `parse_optional_utc`, and `ErrorCode`.

- [ ] **Step 1: Write helper tests**

```python
from __future__ import annotations

from datetime import timezone

import pytest

from app.core.csv import csv_safe
from app.core.errors import ApiError, ErrorCode
from app.core.pagination import page_offset, page_response
from app.core.roles import ADMIN_ROLES, STAFF_ROLES, WRITE_ROLES
from app.core.time import parse_optional_utc


def test_role_sets_are_single_source_of_truth():
    assert STAFF_ROLES == ("SECURITY_ADMIN", "SECURITY_ANALYST", "AUDITOR")
    assert WRITE_ROLES == ("SECURITY_ADMIN", "SECURITY_ANALYST")
    assert ADMIN_ROLES == ("SECURITY_ADMIN",)


def test_csv_safe_prefixes_spreadsheet_formulas():
    assert csv_safe("=cmd|' /C calc'!A0") == "'=cmd|' /C calc'!A0"
    assert csv_safe("normal") == "normal"


def test_pagination_helpers_preserve_page_shape():
    assert page_offset(3, 25) == 50
    page = page_response(["a", "b"], total=12, page=2, page_size=10)
    assert page.model_dump() == {"items": ["a", "b"], "total": 12, "page": 2, "page_size": 10}


def test_time_parser_normalizes_utc_and_rejects_invalid_values():
    assert parse_optional_utc(None, "from_time") is None
    assert parse_optional_utc("2026-01-02T03:04:05Z", "from_time").tzinfo == timezone.utc
    with pytest.raises(ApiError) as error:
        parse_optional_utc("not-a-time", "from_time")
    assert error.value.code == ErrorCode.INVALID_TIME_FILTER
```

- [ ] **Step 2: Run to verify failure**

Run from `backend/`: `.\.venv\Scripts\python.exe -m pytest tests\test_shared_helpers.py -q`
Expected: FAIL with missing modules.

- [ ] **Step 3: Implement the helpers**

```python
# app/core/roles.py
STAFF_ROLES = ("SECURITY_ADMIN", "SECURITY_ANALYST", "AUDITOR")
WRITE_ROLES = ("SECURITY_ADMIN", "SECURITY_ANALYST")
ADMIN_ROLES = ("SECURITY_ADMIN",)

# app/core/pagination.py
from typing import TypeVar

from app.api.schemas import Page

T = TypeVar("T")


def page_offset(page: int, page_size: int) -> int:
    return (page - 1) * page_size


def page_response(items: list[T], *, total: int, page: int, page_size: int) -> Page[T]:
    return Page(items=items, total=total, page=page, page_size=page_size)

# app/core/csv.py
import csv
import io
from collections.abc import Iterable, Sequence
from fastapi import Response


def csv_safe(value: object) -> str:
    text = "" if value is None else str(value)
    return f"'{text}" if text.startswith(("=", "+", "-", "@")) else text


def csv_download(
    *, headers: Sequence[str], rows: Iterable[Sequence[object]], filename: str, correlation_id: str
) -> Response:
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(headers)
    for row in rows:
        writer.writerow([csv_safe(value) for value in row])
    return Response(
        content=output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Correlation-ID": correlation_id,
        },
    )

# app/core/time.py additions
from app.core.errors import ApiError, ErrorCode


def parse_optional_utc(value: str | None, field: str):
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ApiError(422, ErrorCode.INVALID_TIME_FILTER, f"{field} must be an ISO 8601 timestamp.") from exc
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)
```

Add `ErrorCode` as a `StrEnum` in `core/errors.py` containing at least `VALIDATION_ERROR`, `INTERNAL_ERROR`, `NOT_AUTHENTICATED`, `FORBIDDEN`, `INVALID_TIME_FILTER`, `RATE_LIMITED`, and `CSRF_VALIDATION_FAILED`.

Move `Page`, `ErrorBody`, and `ErrorResponse` from `app/schemas.py` to `app/api/schemas.py`; leave compatibility re-exports in `app/schemas.py` marked `# TEMP-COMPAT`. Keep the class names `Page`, `ErrorBody`, and `ErrorResponse` unchanged so OpenAPI schema names do not drift.

- [ ] **Step 4: Replace duplicates**

Replace all local `STAFF_ROLES`, `WRITE_ROLES`, role literals, `_csv_safe`, `_parse_time`, `(page - 1) * page_size`, and manual `Page(...)` construction with the new helpers. Preserve each endpoint’s exact `Page` values and CSV columns.

- [ ] **Step 5: Verify**

Run from `backend/`: `.\.venv\Scripts\python.exe -m pytest tests\test_shared_helpers.py tests\test_access_service.py tests\test_policies.py tests\test_events_incidents.py -q`
Run from `backend/`: `.\.venv\Scripts\python.exe -m pytest -q`
Expected: all pass; total remains at least 83.

- [ ] **Step 6: Commit**

```bash
git add backend/app backend/tests/test_shared_helpers.py
git commit -m "refactor: centralize backend shared helpers"
```

### Task 5: Harden transactions and split configuration

**Files:**
- Modify: `backend/app/core/database.py`
- Move: `backend/app/core/config.py` to `backend/app/core/config/settings.py`
- Create: `backend/app/core/config/{__init__.py,runtime.py,database.py,auth.py,bootstrap.py,model.py,limits.py,validation.py}`
- Modify: `backend/tests/test_config.py`
- Create: `backend/tests/test_database.py`

**Interfaces:**
- Consumes: existing env names and defaults.
- Produces: unchanged `get_settings()` and `Settings`, fail-closed validation, and rollback-on-exception `get_db()`.

- [ ] **Step 1: Write rollback and config tests**

```python
from __future__ import annotations

import pytest
from sqlalchemy import text

from app.core.config import Settings, validate_runtime_settings
from app.core.database import get_db


def test_get_db_rolls_back_uncommitted_work(monkeypatch):
    generator = get_db()
    db = next(generator)
    db.execute(text("CREATE TEMP TABLE rollback_probe (value INTEGER)"))
    db.execute(text("INSERT INTO rollback_probe VALUES (1)"))
    db.flush()
    with pytest.raises(RuntimeError):
        generator.throw(RuntimeError("boom"))
    assert db.in_transaction() is False
    db.close()


def test_production_configuration_fails_closed(monkeypatch):
    settings = Settings(
        environment="production",
        cookie_secure=False,
        demo_mode=True,
        allowed_origins="*",
    )
    with pytest.raises(ValueError):
        validate_runtime_settings(settings)
```

- [ ] **Step 2: Run to verify failure**

Run from `backend/`: `.\.venv\Scripts\python.exe -m pytest tests\test_database.py tests\test_config.py -q`
Expected: rollback test fails; config tests still pass.

- [ ] **Step 3: Implement rollback**

```python
def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
```

- [ ] **Step 4: Split config into grouped mixins**

```python
# app/core/config/settings.py
class Settings(
    RuntimeFields,
    DatabaseFields,
    AuthFields,
    BootstrapFields,
    ModelFields,
    LimitFields,
    BaseSettings,
):
    model_config = SettingsConfigDict(
        env_prefix="AEGIS_",
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )
```

Each field module owns only its fields and properties: runtime origins/demo/development, database URL resolution, auth/session cookies, bootstrap admin, model artifacts, and rate/WebSocket limits. `app/core/config/__init__.py` exports `Settings`, `get_settings`, and `validate_runtime_settings`. Preserve every field name, env name, default, property, and validation message.

`BACKEND_DIR` currently resolves via `parents[2]` from `app/core/config.py`. After moving to `app/core/config/settings.py`, recompute it as `Path(__file__).resolve().parents[3]` (or move it to a shared constants module) so `resolved_database_url` and `artifact_path` keep pointing at `backend/`. The `env_file=(".env", "../.env")` value is CWD-relative today; keep it unchanged.

- [ ] **Step 5: Verify configuration and full backend**

Run from `backend/`: `.\.venv\Scripts\python.exe -m pytest tests\test_config.py tests\test_bootstrap.py tests\test_database.py -q`
Run from `backend/`: `.\.venv\Scripts\python.exe -m pytest -q`
Run from `backend/`: `.\.venv\Scripts\python.exe -m compileall -q app scripts`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add backend/app/core backend/tests
git commit -m "refactor: split configuration and harden database rollback"
```

### Task 5b: Centralize SQLAlchemy models under `db/models.py`

**Files:**
- Create: `backend/app/db/__init__.py`
- Move: `backend/app/models.py` to `backend/app/db/models.py`
- Modify: `backend/app/core/database.py`, `backend/alembic/env.py`, `backend/scripts/*.py`, all `backend/app/**/*.py` imports, and `backend/tests/*.py` imports
- Keep: `backend/app/models.py` as a `# TEMP-COMPAT` re-export (`from app.db.models import *`) until Task 18

**Interfaces:**
- Consumes: unchanged model classes, enums, `new_id`, `utcnow`, and relationships.
- Produces: `app.db.models` as the single model location while old imports keep working.

- [ ] **Step 1: Move the module**

Create `backend/app/db/__init__.py`, move `backend/app/models.py` to `backend/app/db/models.py` without changing class definitions or table names, and leave a compatibility module at `backend/app/models.py` containing `from app.db.models import *  # noqa: F401,F403`.

- [ ] **Step 2: Update internal registration imports**

Update `app/core/database.py`'s `init_db` to import `app.db.models`, and update `backend/alembic/env.py` to import `app.db.models` so metadata registration and migrations are unchanged.

- [ ] **Step 3: Update new code imports**

Use `app.db.models` in all new domain code from this point forward. Existing modules and tests may keep `app.models` through the compatibility re-export.

- [ ] **Step 4: Verify**

Run from `backend/`: `.\.venv\Scripts\python.exe -m pytest -q`
Run from `backend/`: `.\.venv\Scripts\alembic.exe upgrade head`
Run from `backend/`: `.\.venv\Scripts\alembic.exe check`
Run: `backend\.venv\Scripts\python.exe backend\scripts\export_openapi.py` and confirm no diff.
Expected: all pass; OpenAPI unchanged; migration check clean.

- [ ] **Step 5: Commit**

```bash
git add backend/app backend/alembic/env.py backend/tests
git commit -m "refactor: centralize models under db"
```

### Task 6: Add frontend environment and HTTP foundations

**Files:**
- Create: `frontend/src/config/env.ts`
- Create: `frontend/src/lib/http.ts`
- Create: `frontend/src/lib/storage.ts`
- Create: `frontend/src/config/env.test.ts`
- Create: `frontend/src/lib/http.test.ts`
- Modify: `frontend/src/services/api.ts`
- Modify: `frontend/src/hooks/useRealtime.ts`
- Move: port every case from `frontend/src/services/api.test.ts` into `frontend/src/lib/http.test.ts`, then delete the old test file

**Interfaces:**
- Consumes: `import.meta.env` and existing API behavior.
- Produces: frozen `env`, `ApiError`, `request`, `download`, `buildQuery`, `messageFromError`, `websocketUrl`, and `safeStorage`.

- [ ] **Step 1: Write env and HTTP tests**

```typescript
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("env", () => {
  it("keeps demo disabled in production unless explicitly enabled", async () => {
    vi.stubEnv("PROD", true);
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_DEMO_MODE", "");
    const { env } = await import("./env");
    expect(env.demoEnabled).toBe(false);
    expect(env.demoPassword).toBe("");
  });

  it("uses a configured API base without exposing secrets", async () => {
    vi.stubEnv("VITE_API_BASE", "/secure-api");
    const { env } = await import("./env");
    expect(env.apiBase).toBe("/secure-api");
  });
});
```

```typescript
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, buildQuery, request } from "./http";

afterEach(() => vi.unstubAllGlobals());

describe("http", () => {
  it("adds double-submit CSRF headers for unsafe methods", async () => {
    document.cookie = "aegis_csrf=csrf-test";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await request("/demo/run", { method: "POST" });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Headers).get("X-CSRF-Token")).toBe("csrf-test");
    expect(init.credentials).toBe("include");
  });

  it("preserves the error envelope contract", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ error: { code: "FORBIDDEN", message: "Denied." } }),
          { status: 403, headers: { "content-type": "application/json" } },
        ),
      ),
    );
    await expect(request("/audit")).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN",
      message: "Denied.",
    });
  });
});
```

Port every case from `frontend/src/services/api.test.ts` into `frontend/src/lib/http.test.ts` (query dropping, repeated array params, unauthorized broadcast, session-probe suppression, and network failure). Do not reduce coverage when the old file is removed.

- [ ] **Step 2: Run to verify failure**

Run from `frontend/`: `npm run test -- src/config/env.test.ts src/lib/http.test.ts`
Expected: FAIL with missing modules.

- [ ] **Step 3: Implement the frozen environment facade**

```typescript
const apiBase = import.meta.env.VITE_API_BASE ?? "/api";
const wsPath = import.meta.env.VITE_WS_PATH ?? "/api/ws/events";
const explicitlyEnabled = import.meta.env.VITE_DEMO_MODE === "true";
const explicitlyDisabled = import.meta.env.VITE_DEMO_MODE === "false";
const demoEnabled = explicitlyEnabled || (import.meta.env.DEV && !explicitlyDisabled);
const demoPassword =
  import.meta.env.VITE_DEMO_PASSWORD ??
  (import.meta.env.DEV && demoEnabled ? "ChangeMe-Demo!2026" : "");

export const env = Object.freeze({ apiBase, wsPath, demoEnabled, demoPassword });
export function websocketUrl(): string {
  if (wsPath.startsWith("ws://") || wsPath.startsWith("wss://")) return wsPath;
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${wsPath}`;
}
```

Move `ApiError`, `buildQuery`, `request`, `download`, and `messageFromError` from `services/api.ts` to `lib/http.ts`; import `env.apiBase` there. Move `websocketUrl` into `config/env.ts` and import `env.wsPath` there. `services/api.ts` keeps its existing `api` object temporarily and re-exports every moved symbol, including `websocketUrl`.

- [ ] **Step 4: Add safe storage**

```typescript
export const safeStorage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Storage is optional.
    }
  },
};
```

Use the same guarded pattern for `sessionStorage` in auth logic.

- [ ] **Step 5: Verify**

Run from `frontend/`: `npm run test -- src/config/env.test.ts src/lib/http.test.ts`
Run from `frontend/`: `npm run typecheck`
Expected: tests pass; typecheck passes.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/config frontend/src/lib frontend/src/services/api.ts frontend/src/hooks/useRealtime.ts
git rm frontend/src/services/api.test.ts
git commit -m "refactor: centralize frontend env and HTTP handling"
```

### Task 7: Add query defaults, Zustand stores, and toast/theme facades

**Files:**
- Create: `frontend/src/app/query-client.ts`
- Create: `frontend/src/features/auth/store.ts`
- Create: `frontend/src/features/toast/store.ts`
- Create: `frontend/src/features/toast/Toaster.tsx`
- Create: `frontend/src/features/preferences/store.ts`
- Create: `frontend/src/features/preferences/useTheme.ts`
- Create: `frontend/src/features/auth/store.test.ts`
- Create: `frontend/src/features/toast/store.test.ts`
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`

**Interfaces:**
- Consumes: `lib/storage.ts`, `lib/http.ts`.
- Produces: `queryClient`, `useAuthStore`, `useToastStore`, `toast`, `useToast`, `usePreferencesStore`, and `useTheme`.

- [ ] **Step 1: Install Zustand**

Run from `frontend/`: `npm install zustand`
Expected: dependency added.

- [ ] **Step 2: Write store tests**

```typescript
import { beforeEach, describe, expect, it } from "vitest";
import { useAuthStore } from "./store";

describe("auth store", () => {
  beforeEach(() => useAuthStore.setState({ sessionNotice: false }));

  it("tracks an expired-session notice", () => {
    useAuthStore.getState().setSessionNotice(true);
    expect(useAuthStore.getState().sessionNotice).toBe(true);
  });
});
```

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast, useToastStore } from "./store";

describe("toast store", () => {
  beforeEach(() => {
    useToastStore.setState({ items: [] });
    vi.useFakeTimers();
  });

  it("caps visible toasts and removes them after five seconds", () => {
    toast.info("one");
    toast.info("two");
    toast.info("three");
    toast.info("four");
    toast.info("five");
    expect(useToastStore.getState().items).toHaveLength(4);
    vi.advanceTimersByTime(5200);
    expect(useToastStore.getState().items).toHaveLength(0);
    vi.useRealTimers();
  });
});
```

- [ ] **Step 3: Implement stores and facades**

```typescript
// features/auth/store.ts
import { create } from "zustand";

interface AuthState {
  sessionNotice: boolean;
  setSessionNotice: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  sessionNotice: false,
  setSessionNotice: (sessionNotice) => set({ sessionNotice }),
}));
```

```typescript
// features/toast/store.ts
import { create } from "zustand";

export type ToastTone = "success" | "error" | "info";
export interface ToastItem { id: number; tone: ToastTone; title: string; description?: string }
interface ToastState {
  items: ToastItem[];
  push: (tone: ToastTone, title: string, description?: string) => void;
  remove: (id: number) => void;
}

let nextId = 0;
export const useToastStore = create<ToastState>()((set, get) => ({
  items: [],
  push: (tone, title, description) => {
    const id = ++nextId;
    set({ items: [...get().items.slice(-3), { id, tone, title, description }] });
    window.setTimeout(() => get().remove(id), 5200);
  },
  remove: (id) => set({ items: get().items.filter((item) => item.id !== id) }),
}));

export const toast = {
  success: (title: string, description?: string) => useToastStore.getState().push("success", title, description),
  error: (title: string, description?: string) => useToastStore.getState().push("error", title, description),
  info: (title: string, description?: string) => useToastStore.getState().push("info", title, description),
};
```

`query-client.ts` must contain the exact existing defaults. `Toaster.tsx` preserves existing toast markup and ARIA. `preferences/store.ts` persists only theme/sidebar preferences through `safeStorage`; `useTheme.ts` applies `data-theme` and `color-scheme` exactly as the current provider does.

- [ ] **Step 4: Keep old hooks as facades**

Rewrite `frontend/src/hooks/useToast.tsx` to export `useToast()` returning the store actions and keep `ToastProvider` as a temporary pass-through. Rewrite `useTheme.tsx` similarly with temporary `ThemeProvider`. Do not change consumers yet.

- [ ] **Step 5: Verify**

Run from `frontend/`: `npm run test -- src/features/auth/store.test.ts src/features/toast/store.test.ts src/components/ui/ui.test.tsx`
Run from `frontend/`: `npm run typecheck`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src
git commit -m "refactor: introduce query and client-state foundations"
```

### Task 8: Split UI primitives and consolidate dialog focus

**Files:**
- Create: `frontend/src/components/ui/{surfaces.tsx,badges.tsx,feedback.tsx,forms.tsx,overlays.tsx,data.tsx}`
- Create: `frontend/src/components/ui/overlays.test.tsx`
- Modify: `frontend/src/components/ui/index.tsx`
- Modify: `frontend/src/components/ui/ui.test.tsx`
- Modify: `frontend/src/hooks/useDialogFocus.ts` only if a generic behavior is missing

**Interfaces:**
- Consumes: all existing exports of `components/ui/index.tsx`.
- Produces: identical imports through the barrel, plus one focus implementation.

- [ ] **Step 1: Write the overlay behavior test**

```tsx
import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Modal } from "./index";

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Focus test">
        <button>Inside</button>
      </Modal>
    </>
  );
}

describe("Modal focus behavior", () => {
  it("focuses content, closes on Escape, and restores trigger focus", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Open" }));
    const dialog = screen.getByRole("dialog");
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open" })).toHaveFocus();
  });
});
```

- [ ] **Step 2: Run to verify current duplicate behavior**

Run from `frontend/`: `npm run test -- src/components/ui/overlays.test.tsx`
Expected: FAIL before Step 4, because the current `Modal`/`Drawer` do not move initial focus or restore trigger focus.

- [ ] **Step 3: Split the barrel**

Move components without changing markup or classes:

- `surfaces.tsx`: `Panel`, `Card`, `SectionHeading`, `PageHeader`, `StatCard`, `Callout`.
- `badges.tsx`: `Badge`, `RiskBadge`, `DecisionBadge`, `SeverityBadge`, `IncidentStatusBadge`, `SimulatedTag`, `Avatar`.
- `feedback.tsx`: `Skeleton`, `LoadingPanel`, `EmptyState`, `ErrorState`, `Spinner`, `ForbiddenState`.
- `forms.tsx`: `Button`, `Field`, `TextInput`, `SearchInput`, `SelectInput`, `TextArea`, `Toggle`, `Tabs`.
- `overlays.tsx`: `Modal`, `Drawer`.
- `data.tsx`: `Pagination`, `KeyValue`, `CopyInline`, `Progress`, `RiskGauge`.

`index.tsx` becomes export-only and re-exports every existing symbol.

- [ ] **Step 4: Use one focus hook**

In `Modal` and `Drawer`, replace the local Escape/scroll-lock effects with `useDialogFocus(open, onClose)`. Attach the returned ref to the dialog container and keep `role="dialog"`, `aria-modal`, labels, portal targets, classes, and close controls unchanged.

- [ ] **Step 5: Verify UI**

Run from `frontend/`: `npm run test -- src/components/ui/ui.test.tsx src/components/ui/overlays.test.tsx src/hooks/useDialogFocus.test.tsx`
Run from `frontend/`: `npm run typecheck`
Run from `frontend/`: `npm run build`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/ui frontend/src/hooks/useDialogFocus.ts
git commit -m "refactor: split UI primitives and unify dialog focus"
```

### Task 9: Extract audit and events backend domains

**Files:**
- Create: `backend/app/domains/audit/{__init__.py,schemas.py,repository.py,service.py,presenters.py,router.py}`
- Create: `backend/app/domains/events/{__init__.py,schemas.py,repository.py,service.py,presenters.py,router.py}`
- Move: `backend/app/audit/service.py` to `backend/app/domains/audit/service.py`
- Move: `backend/app/services/events.py` to `backend/app/domains/events/service.py`
- Move: `backend/app/realtime.py` to `backend/app/realtime/__init__.py` (keeps `from app.realtime import realtime` valid)
- Modify: `backend/app/schemas.py`, `backend/app/serializers.py`, `backend/app/api/audit.py`, `backend/app/api/events.py`, `backend/app/audit/service.py`, `backend/app/services/events.py`
- Test: existing `test_overview_audit_model.py`, `test_events_incidents.py`, `test_event_stream.py`

**Interfaces:**
- Consumes: `append_audit`, `audit_count`, `verify_audit_chain`, `record_event`, `event_payload`.
- Produces: domain routers included by `app.api.router`; old imports remain valid through `# TEMP-COMPAT` re-exports.

- [ ] **Step 1: Create the audit repository and service interfaces**

```python
# domains/audit/repository.py
def list_audit_rows(db: Session, filters: list, *, page: int, page_size: int) -> tuple[list[AuditLog], int]: ...
def list_audit_export_rows(db: Session, filters: list, *, limit: int = 10000) -> list[AuditLog]: ...

# domains/audit/service.py
def append_audit(db: Session, *, actor: Identity | None, actor_label: str | None = None, action: str, target_type: str, target_id: str | None, correlation_id: str, result: str = "SUCCESS", policy_version: str | None = None, metadata: dict | None = None) -> AuditLog: ...
def audit_count(db: Session) -> int: ...
def verify_audit_chain(db: Session) -> tuple[bool, int, str | None, str]: ...
def list_audit(db: Session, *, filters: dict, page: int, page_size: int) -> Page[AuditOut]: ...
def export_audit(db: Session, *, actor: Identity, filters: dict) -> CsvExport: ...
```

`CsvExport` is a frozen dataclass with `content`, `filename`, and `correlation_id`. `export_audit` owns `append_audit` and `db.commit()`. Extract filter construction into `service.build_audit_filters` using `parse_optional_utc`.

- [ ] **Step 2: Create the events repository and service interfaces**

```python
# domains/events/repository.py
def list_event_rows(db: Session, *, filters: dict, page: int, page_size: int) -> tuple[list[SecurityEvent], int]: ...
def get_event_row(db: Session, event_id: str) -> SecurityEvent | None: ...
def list_notification_rows(db: Session, *, limit: int = 8) -> list[SecurityEvent]: ...

# domains/events/service.py
def record_event(db: Session, *, event_type: str, category: str, summary: str, correlation_id: str, severity: str = Severity.LOW.value, identity_id: str | None = None, device_id: str | None = None, access_request_id: str | None = None, incident_id: str | None = None, actor_id: str | None = None, policy_version: str | None = None, details: dict[str, Any] | None = None, is_simulated: bool = False) -> SecurityEvent: ...
def list_events(db: Session, *, filters: dict, page: int, page_size: int) -> Page[SecurityEventOut]: ...
def get_event(db: Session, event_id: str) -> SecurityEventOut: ...
def list_notifications(db: Session) -> list[NotificationOut]: ...
```

Keep WebSocket authorization, `4401` close, heartbeat, and revalidation in the events router/service with the exact existing semantics.

- [ ] **Step 3: Move routers and compatibility exports**

The new routers own only dependencies, query parameters, and response construction. Add compatibility modules:

```python
# app/api/audit.py (TEMP-COMPAT)
from app.domains.audit.router import router
```

```python
# app/audit/service.py (TEMP-COMPAT)
from app.domains.audit.service import *
```

```python
# app/services/events.py (TEMP-COMPAT)
from app.domains.events.service import *
```

Re-export `AuditOut`, `AuditVerifyOut`, `SecurityEventOut`, and `NotificationOut` from `app/schemas.py` during migration. Move `app/realtime.py` into `app/realtime/__init__.py` without changing its contents or exports.

- [ ] **Step 4: Verify focused and full backend**

Run from `backend/`: `.\.venv\Scripts\python.exe -m pytest tests\test_overview_audit_model.py tests\test_events_incidents.py tests\test_event_stream.py -q`
Run from `backend/`: `.\.venv\Scripts\python.exe -m pytest -q`
Run from `backend/`: `.\.venv\Scripts\alembic.exe check`
Expected: all pass; OpenAPI snapshot unchanged.

- [ ] **Step 5: Commit**

```bash
git add backend/app
git commit -m "refactor: extract audit and events domains"
```

### Task 10: Extract auth and system backend domains

**Files:**
- Create: `backend/app/domains/auth/{__init__.py,schemas.py,repository.py,service.py,presenters.py,router.py}`
- Create: `backend/app/domains/system/{__init__.py,schemas.py,service.py,repository.py,router.py}`
- Create: `backend/app/api/router.py`
- Modify: `backend/app/main.py`, `backend/app/api/auth.py`, `backend/app/api/health.py`, `backend/app/api/settings.py`, `backend/tests/test_health.py`
- Move: `backend/app/audit/service.py` consumers only; no audit code moves in this task

**Interfaces:**
- Consumes: `AuthContext`, session/cookie helpers, health verification, audit chain.
- Produces: `/api`, `/api/health*`, `/api/settings/info`, `/api/auth/*` through `api/router.py`.

- [ ] **Step 1: Create auth service interfaces**

```python
# domains/auth/repository.py
def find_identity_by_email(db: Session, email: str) -> Identity | None: ...

# domains/auth/service.py
@dataclass(frozen=True)
class LoginResult:
    payload: MeOut
    raw_token: str
    csrf_token: str
    max_age_seconds: int

def authenticate(db: Session, *, email: str, password: str, client_ip: str, user_agent: str | None) -> LoginResult: ...
def me_payload(auth: AuthContext) -> MeOut: ...
def logout(db: Session, *, auth: AuthContext) -> None: ...
```

`authenticate` owns failed-login event/audit commits and successful-login event/audit/session commit. Router sets cookies exactly as today. Preserve `INVALID_CREDENTIALS`, rate-limit headers, event types, audit actions, `last_activity_at`, and cookie attributes.

- [ ] **Step 2: Create system service and router**

```python
# domains/system/service.py
def api_metadata() -> dict[str, str]: ...
def health() -> dict[str, str]: ...
def build_health_status() -> HealthStatus: ...
def readiness() -> tuple[dict[str, object], bool]: ...
def settings_info() -> SettingsInfoOut: ...

# domains/system/router.py
router = APIRouter(tags=["meta"])

@router.get("")
def api_root() -> dict[str, str]: ...

@router.get("/health")
def health() -> dict[str, str]: ...

@router.get("/health/ready")
def readiness(response: Response) -> dict[str, object]: ...

@router.get("/health/detailed", response_model=HealthStatus)
def detailed_health(auth: AuthContext = Depends(get_auth_context)) -> HealthStatus: ...

@router.get("/settings/info", response_model=SettingsInfoOut)
def settings_info(auth: AuthContext = Depends(require_roles(*STAFF_ROLES))) -> SettingsInfoOut: ...
```

Preserve operation IDs by keeping endpoint function names and paths identical. `test_health.py` must monkeypatch `app.domains.system.service.database_is_available` instead of the compatibility module.

- [ ] **Step 3: Compose the API router**

```python
# app/api/router.py
router = APIRouter(prefix="/api")
router.include_router(system.router)
router.include_router(auth.router)
# include remaining domain routers here
```

`main.py` includes only `api_router.router`. Remove the inline `/api` root handler from `main.py`. Keep old `app/api/auth.py`, `health.py`, and `settings.py` as `# TEMP-COMPAT` router re-exports. `app/api/health.py` must also re-export `build_health_status` from `app.domains.system.service` because `app/api/overview.py` still imports it until Task 13.

- [ ] **Step 4: Verify**

Run from `backend/`: `.\.venv\Scripts\python.exe -m pytest tests\test_auth.py tests\test_health.py tests\test_csrf.py tests\test_openapi_contract.py -q`
Run from `backend/`: `.\.venv\Scripts\python.exe -m pytest -q`
Expected: all pass; OpenAPI equality passes.

- [ ] **Step 5: Commit**

```bash
git add backend/app backend/tests/test_health.py
git commit -m "refactor: extract auth and system domains"
```

### Task 11: Extract identities and devices backend domains

**Files:**
- Create: `backend/app/domains/identities/{__init__.py,schemas.py,repository.py,service.py,presenters.py,router.py}`
- Create: `backend/app/domains/devices/{__init__.py,schemas.py,repository.py,service.py,presenters.py,router.py}`
- Modify: `backend/app/api/identities.py`, `backend/app/api/devices.py`, `backend/app/schemas.py`, `backend/app/serializers.py`, `backend/app/api/router.py`

**Interfaces:**
- Consumes: shared models, `active_session_count`, access/event/audit presenters.
- Produces: identity list/detail and device list/enroll/state services/repositories with unchanged responses.

- [ ] **Step 1: Create identities interfaces**

```python
# domains/identities/repository.py
def list_identity_rows(db: Session, *, filters: dict, page: int, page_size: int) -> tuple[list[Identity], int]: ...
def get_identity_row(db: Session, identity_id: str) -> Identity | None: ...
def list_sessions(db: Session, identity_id: str, *, limit: int = 10) -> list[UserSession]: ...
def list_devices(db: Session, identity_id: str) -> list[Device]: ...
def list_recent_access(db: Session, identity_id: str, *, limit: int = 10) -> list[AccessRequest]: ...
def list_behavior(db: Session, identity_id: str, *, limit: int = 30) -> list[BehavioralEvent]: ...
def list_alerts(db: Session, identity_id: str, *, limit: int = 10) -> list[SecurityEvent]: ...
def list_audits(db: Session, identity_id: str, *, limit: int = 10) -> list[AuditLog]: ...

# domains/identities/service.py
def list_identities(db: Session, *, filters: dict, page: int, page_size: int) -> Page[IdentitySummary]: ...
def get_identity(db: Session, *, identity_id: str, auth: AuthContext) -> IdentityDetail: ...
```

Preserve own-identity access and staff authorization.

- [ ] **Step 2: Create devices interfaces**

```python
# domains/devices/repository.py
def list_device_rows(db: Session, *, filters: dict, page: int, page_size: int) -> tuple[list[Device], int]: ...
def get_device_row(db: Session, device_id: str) -> Device | None: ...

# domains/devices/service.py
def list_devices(db: Session, *, filters: dict, page: int, page_size: int) -> Page[DeviceOut]: ...
def enroll_device(db: Session, *, payload: DeviceEnrollIn, actor: Identity) -> DeviceOut: ...
def update_device_state(db: Session, *, device_id: str, payload: DeviceStateIn, actor: Identity) -> DeviceOut: ...
```

`enroll_device` and `update_device_state` own event/audit writes and `db.commit()`. Preserve every 404/409 code and message, trust-transition rule, event type, severity, metadata, and refresh.

- [ ] **Step 3: Move presenters and schemas**

Move `identity_summary`, `device_out`, and `behavioral_signal_out` to the owning domain `presenters.py`. Move `IdentitySummary`, `IdentityDetail`, `RiskPoint`, `SessionOut`, `BehavioralSignalOut`, `DeviceOut`, `DeviceEnrollIn`, and `DeviceStateIn` to domain `schemas.py`. Keep `# TEMP-COMPAT` re-exports.

- [ ] **Step 4: Compose routers**

Add both domain routers to `api/router.py`. Old `app/api/identities.py` and `devices.py` become `# TEMP-COMPAT` router re-exports. Routers must not import `sqlalchemy` or commit.

- [ ] **Step 5: Verify**

Run from `backend/`: `.\.venv\Scripts\python.exe -m pytest tests\test_identities_devices.py tests\test_contract_characterization.py tests\test_openapi_contract.py -q`
Run from `backend/`: `.\.venv\Scripts\python.exe -m pytest -q`
Expected: all pass; OpenAPI unchanged.

- [ ] **Step 6: Commit**

```bash
git add backend/app
git commit -m "refactor: extract identities and devices domains"
```

### Task 12: Extract access and policies backend domains

**Files:**
- Create: `backend/app/domains/access/{__init__.py,schemas.py,repository.py,service.py,presenters.py,router.py}`
- Create: `backend/app/domains/policies/{__init__.py,schemas.py,repository.py,service.py,engine.py,router.py}`
- Move: `backend/app/services/access.py` to `backend/app/domains/access/service.py`
- Move: `backend/app/policies/engine.py` to `backend/app/domains/policies/engine.py`
- Modify: `backend/app/api/access.py`, `backend/app/api/policies.py`, `backend/app/schemas.py`, `backend/app/serializers.py`, `backend/app/api/router.py`, `backend/app/services/access.py`, `backend/app/policies/engine.py`

**Interfaces:**
- Consumes: `evaluate_access`, `evaluate_policy`, incident escalation service, audit/event services.
- Produces: access list/detail/evaluate/export and policy list/detail/history/update/preview behavior unchanged.

- [ ] **Step 1: Create access interfaces**

```python
# domains/access/repository.py
def scoped_request_query(auth: AuthContext, *, identity_id: str | None = None): ...
def list_access_rows(db: Session, *, auth: AuthContext, filters: dict, page: int, page_size: int) -> tuple[list[AccessRequest], int]: ...
def list_access_export_rows(db: Session, *, auth: AuthContext, filters: dict, limit: int = 5000) -> list[AccessRequest]: ...
def get_access_row(db: Session, request_id: str) -> AccessRequest | None: ...
def get_identity(db: Session, identity_id: str) -> Identity | None: ...
def get_resource(db: Session, resource_id: str) -> Resource | None: ...
def get_device(db: Session, device_id: str) -> Device | None: ...

# domains/access/service.py
def list_access_requests(db: Session, *, auth: AuthContext, filters: dict, page: int, page_size: int) -> Page[AccessRequestOut]: ...
def get_access_request(db: Session, *, request_id: str, auth: AuthContext) -> AccessRequestDetail: ...
def evaluate_access_request(db: Session, *, payload: EvaluateAccessIn, auth: AuthContext) -> DecisionOut: ...
def export_access_requests(db: Session, *, auth: AuthContext, filters: dict) -> CsvExport: ...
def evaluate_access(...) -> EvaluationOutcome: ...
```

Preserve employee ownership rules, auditor read-only rule, staff simulation rule, model-unavailable 503, CSV columns/cap/filename, correlation ID, audit action, and commit boundaries. `EvaluationOutcome` stays in the access service.

- [ ] **Step 2: Create policy interfaces**

```python
# domains/policies/repository.py
def active_policy(db: Session, resource_id: str) -> AccessPolicy | None: ...
def policy_version_count(db: Session, resource_id: str) -> int: ...
def list_resource_rows(db: Session, *, q: str | None, sensitivity: str | None) -> list[Resource]: ...
def get_resource_row(db: Session, resource_id: str) -> Resource | None: ...
def list_policy_rows(db: Session, resource_id: str) -> list[AccessPolicy]: ...

# domains/policies/service.py
def list_resources(db: Session, *, q: str | None, sensitivity: str | None) -> list[ResourcePolicyOut]: ...
def get_resource(db: Session, resource_id: str) -> ResourcePolicyOut: ...
def get_policy_history(db: Session, resource_id: str) -> list[PolicyOut]: ...
def update_policy(db: Session, *, resource_id: str, payload: PolicyUpdateIn, actor: Identity) -> PolicyOut: ...
def preview_policy(payload: PolicyPreviewIn) -> PolicyPreviewOut: ...
```

`update_policy` owns version replacement, event/audit writes, and commit. Preserve `POLICY_MUST_BE_ACTIVE`, version numbering, policy version label, event details, and preview decision mapping.

- [ ] **Step 3: Move schemas, presenters, and engine compatibility**

Move `AccessRequestOut`, `AccessRequestDetail`, `ReasonOut`, `EvaluateAccessIn`, `DecisionOut`, `PolicyOut`, `ResourceOut`, `ResourcePolicyOut`, `PolicyUpdateIn`, `PolicyPreviewCase`, `PolicyPreviewIn`, `PolicyPreviewResult`, and `PolicyPreviewOut` to domain schemas. Move `access_out` and `access_detail` to access presenters. Re-export the old service, engine, schemas, and serializer names through `# TEMP-COMPAT` modules.

- [ ] **Step 4: Compose and verify**

Add routers to `api/router.py`, then run:

Run from `backend/`: `.\.venv\Scripts\python.exe -m pytest tests\test_access_service.py tests\test_policies.py tests\test_policy_engine.py tests\test_contract_characterization.py -q`
Run from `backend/`: `.\.venv\Scripts\python.exe -m pytest -q`
Run from `backend/`: `.\.venv\Scripts\alembic.exe check`
Expected: all pass; OpenAPI unchanged.

- [ ] **Step 5: Commit**

```bash
git add backend/app
git commit -m "refactor: extract access and policy domains"
```

### Task 13: Extract incidents, overview, model, demo, and seed backend domains

**Files:**
- Create: `backend/app/domains/incidents/{__init__.py,schemas.py,repository.py,service.py,presenters.py,router.py}`
- Create: `backend/app/domains/overview/{__init__.py,schemas.py,repository.py,service.py,router.py}`
- Create: `backend/app/domains/model/{__init__.py,schemas.py,service.py,router.py}`
- Create: `backend/app/domains/demo/{__init__.py,schemas.py,repository.py,service.py,router.py}`
- Move: `backend/app/services/incidents.py` to `backend/app/domains/incidents/service.py`
- Move: `backend/app/services/demo.py` to `backend/app/domains/demo/service.py`
- Move: `backend/app/services/anomaly.py` to `backend/app/domains/access/anomaly.py`
- Move: `backend/app/seed.py` to `backend/app/seed/demo.py`
- Move: `backend/app/services/bootstrap.py` to `backend/app/seed/bootstrap.py`
- Modify: existing compatibility modules and `backend/app/api/router.py`

**Interfaces:**
- Consumes: all prior domain services, ML runtime, realtime, seed data.
- Produces: final backend domain composition with unchanged endpoints and seed functions.

- [ ] **Step 1: Create incident interfaces**

```python
# domains/incidents/repository.py
def list_incident_rows(db: Session, *, filters: dict, page: int, page_size: int) -> tuple[list[Incident], int]: ...
def get_incident_row(db: Session, incident_id: str) -> Incident | None: ...
def list_related_access(db: Session, ids: list[str]) -> list[AccessRequest]: ...
def list_incident_timeline(db: Session, incident_id: str, access_ids: list[str]) -> list[SecurityEvent]: ...
def list_notes(db: Session, incident_id: str) -> list[IncidentNote]: ...

# domains/incidents/service.py
def list_incidents(db: Session, *, filters: dict, page: int, page_size: int) -> Page[IncidentOut]: ...
def get_incident(db: Session, incident_id: str) -> IncidentDetail: ...
def update_incident(db: Session, *, incident_id: str, payload: IncidentUpdateIn, actor: Identity) -> IncidentDetail: ...
def add_incident_note(db: Session, *, incident_id: str, payload: IncidentNoteIn, actor: Identity) -> IncidentNoteOut: ...
def create_or_escalate_for_decision(...) -> Incident: ...
```

Preserve acceptance validation, close-resolution rule, assignee role rule, note events, audit metadata, and commit behavior.

- [ ] **Step 2: Create overview, model, and demo interfaces**

```python
# domains/overview/repository.py
def access_requests_in_range(db: Session, start, end) -> list[AccessRequest]: ...
def events_in_range(db: Session, start, end) -> list[SecurityEvent]: ...
def identities_in_range(db: Session) -> list[Identity]: ...
def active_session_count(db: Session) -> int: ...
def recent_events(db: Session, *, limit: int) -> list[SecurityEvent]: ...

# domains/overview/service.py
def get_overview(db: Session, *, range_hours: int) -> OverviewOut: ...

# domains/model/service.py
def model_evaluation(db: Session, *, actor: Identity) -> ModelEvaluationOut: ...
def model_features() -> list[dict]: ...
def retrain_model(db: Session, *, seed: int, rows: int, actor: Identity) -> ModelEvaluationOut: ...

# domains/demo/service.py
def list_demo_scenarios() -> list[DemoScenarioInfo]: ...
def run_demo_scenarios(db: Session, *, scenario: str | None, actor: Identity) -> DemoRunOut: ...
def reset_demo_data(db: Session) -> DemoResetOut: ...
```

Preserve overview buckets/labels/range behavior, model event/audit actions, demo-mode gate, scenario outputs, and reset counts. The overview service must call `build_health_status` from `app.domains.system.service`, not the deleted `app.api.health` module.

- [ ] **Step 3: Move seed and shared services**

Create `backend/app/seed/__init__.py` exporting `seed_demo_data` and `ensure_bootstrap_admin`. Update imports to `app.seed.demo` and `app.seed.bootstrap`. Move anomaly analysis to `app.domains.access.anomaly`. Add `# TEMP-COMPAT` re-exports at old paths.

- [ ] **Step 4: Compose all routers**

`app/api/router.py` includes exactly: system, auth, identities, devices, access, policies, events, incidents, overview, model, audit, settings-compatible system path, demo. Remove all router includes from `main.py` except `api_router.router`.

- [ ] **Step 5: Verify the complete backend structure**

Run from `backend/`: `.\.venv\Scripts\python.exe -m pytest -q`
Run from `backend/`: `.\.venv\Scripts\python.exe -m compileall -q app scripts`
Run from `backend/`: `.\.venv\Scripts\alembic.exe upgrade head`
Run from `backend/`: `.\.venv\Scripts\alembic.exe check`
Run: `backend\.venv\Scripts\python.exe backend\scripts\export_openapi.py` and confirm `git diff --exit-code -- frontend/openapi.json`
Expected: all pass; snapshot is unchanged.

- [ ] **Step 6: Commit**

```bash
git add backend/app
git commit -m "refactor: complete backend domain extraction"
```

### Task 14: Extract the frontend app shell, auth, settings, employee, overview, and demo

**Files:**
- Move: `frontend/src/App.tsx` to `frontend/src/app/App.tsx`, then update `main.tsx` and `App.test.tsx` imports
- Create: `frontend/src/app/{router.tsx,providers.tsx,error-boundary.tsx}`
- Create: `frontend/src/app/layout/{AppShell.tsx,Sidebar.tsx,Topbar.tsx,CommandPalette.tsx}`
- Move: `frontend/src/components/layout/{AppShell,Sidebar,Topbar,CommandPalette}.tsx` to `frontend/src/app/layout/`; keep `BrandMark.tsx` in shared `components/layout`
- Create: `frontend/src/features/auth/{api.ts,queries.ts,pages/LoginPage.tsx,components/DemoAccounts.tsx}`
- Create: `frontend/src/features/settings/{api.ts,queries.ts,pages/SettingsPage.tsx,components/}`
- Create: `frontend/src/features/employee/{api.ts,queries.ts,model.ts,pages/EmployeeHomePage.tsx,components/}`
- Create: `frontend/src/features/overview/{api.ts,queries.ts,model.ts,pages/OverviewPage.tsx,components/}`
- Create: `frontend/src/features/demo/{api.ts,queries.ts,pages/DemoPage.tsx,components/}`
- Modify: `frontend/src/main.tsx`, `frontend/src/app/App.tsx`, `frontend/src/App.test.tsx`, `frontend/src/hooks/useAuth.tsx`, `frontend/src/hooks/useTheme.tsx`, `frontend/src/hooks/useToast.tsx`, and all imports of moved layout components
- Delete: old pages only after their new page passes tests

**Interfaces:**
- Consumes: `queryClient`, stores, `lib/http.ts`, generated wire types.
- Produces: provider-free app composition with feature routes.

- [ ] **Step 1: Create auth queries**

```typescript
export const authKeys = { me: ["me"] as const };

export function useMe() {
  return useQuery({ queryKey: authKeys.me, queryFn: getMe, retry: false, staleTime: 60_000 });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: login,
    onSuccess: (me) => {
      queryClient.setQueryData(authKeys.me, me);
      useAuthStore.getState().setSessionNotice(false);
    },
  });
}
```

`useAuth` returns the same public shape: `me`, `isLoading`, `isStaff`, `login`, `logout`, `loginError`, `isLoggingIn`, `isLoggingOut`, `clearLoginError`. Unauthorized handling removes non-`me` queries and sets the session notice.

- [ ] **Step 2: Create the app composition**

`app/query-client.ts` exports the same query client defaults. `app/providers.tsx` composes `QueryClientProvider`, `Toaster`, `AppErrorBoundary`, and `Suspense`. `app/router.tsx` owns every existing route, `RequireAuth`, `RequireStaff`, home redirect, identity ownership guard, and lazy imports. `main.tsx` imports `./app/App`.

Move the stateful layout shell (`AppShell`, `Sidebar`, `Topbar`, `CommandPalette`) to `app/layout/` because it consumes auth, theme, realtime, and notification hooks. Keep `BrandMark` in shared `components/layout` because it is presentational only. Shared `components/` must not import `features/`.

Move each page into its feature and split it only along existing visual sections:

- Login: account picker, form, security notes.
- Settings: runtime, session, model, operational sections.
- Employee: risk summary, personal devices, recent access, signals.
- Overview: metrics, timeline, risk distribution, decision breakdown, leaderboard, recent events.
- Demo: scenario controls, run summary, scenario results.

Move overview chart transformations and option arrays into `features/overview/model.ts`.

- [ ] **Step 3: Move feature API/queries**

Each feature `api.ts` exports only its domain calls, for example:

```typescript
export async function getOverview(rangeHours: number): Promise<Overview> {
  return request<Overview>(`/overview${buildQuery({ range_hours: rangeHours })}`);
}
```

Each `queries.ts` exports its own keys, queries, and mutation invalidations. Pages import feature hooks, never `lib/http` or `services/api`.

- [ ] **Step 4: Remove provider nesting**

Remove `AuthProvider`, `ToastProvider`, and `ThemeProvider` from `App.tsx`. Keep `hooks/useAuth.tsx`, `useToast.tsx`, and `useTheme.tsx` as thin `# TEMP-COMPAT` facades re-exporting feature hooks. The app applies theme initialization through the preferences store.

- [ ] **Step 5: Verify**

Run from `frontend/`: `npm run test -- src/App.test.tsx src/features/auth src/features/toast src/features/preferences`
Run from `frontend/`: `npm run typecheck`
Run from `frontend/`: `npm run build`
Run from `frontend/`: `npm run check:build-secrets`
Run from `frontend/`: `npm run e2e`
Expected: unit tests and all 3 Playwright tests pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src
git commit -m "refactor: extract app shell and core frontend features"
```

### Task 15: Extract identities, devices, events, audit, and model features

**Files:**
- Create: `frontend/src/features/identities/{api.ts,queries.ts,model.ts,pages/IdentityPage.tsx,pages/IdentityDetailPage.tsx,pages/BehaviorPage.tsx,components/}`
- Create: `frontend/src/features/devices/{api.ts,queries.ts,model.ts,pages/DevicesPage.tsx,components/}`
- Create: `frontend/src/features/events/{api.ts,queries.ts,model.ts,pages/TimelinePage.tsx,components/}`
- Create: `frontend/src/features/audit/{api.ts,queries.ts,model.ts,pages/AuditPage.tsx,components/}`
- Create: `frontend/src/features/model/{api.ts,queries.ts,pages/ModelPage.tsx,components/}`
- Delete: corresponding old pages after verification

**Interfaces:**
- Consumes: `lib/http.ts`, feature query conventions, shared UI.
- Produces: these routes compose feature hooks/components only.

- [ ] **Step 1: Create API modules**

```typescript
// features/identities/api.ts
export function listIdentities(params: ListParams) { return request<Page<IdentitySummary>>(`/identities${buildQuery(params)}`); }
export function getIdentity(identityId: string) { return request<IdentityDetail>(`/identities/${identityId}`); }

// features/devices/api.ts
export function listDevices(params: ListParams) { return request<Page<Device>>(`/devices${buildQuery(params)}`); }
export function enrollDevice(payload: DeviceEnrollPayload) { return request<Device>("/devices", { method: "POST", body: payload }); }
export function updateDeviceState(deviceId: string, state: DeviceState, reason: string) { return request<Device>(`/devices/${deviceId}/state`, { method: "PATCH", body: { state, reason } }); }
```

Create equivalent functions for events, audit, and model from `services/api.ts`.

- [ ] **Step 2: Move feature models and components**

Move filters, defaults, role labels, chart adapters, and view-model transforms into `model.ts`. Split pages into focused components; target below 300 lines per page and 200 per component:

- Identities: identity table, roster filters, dossier header, session/device/access/behavior/risk/audit sections.
- Devices: device table, enrollment dialog, state-change dialog.
- Events: event filters, event table, detail drawer, notifications list.
- Audit: filters, ledger table, verification panel, export action.
- Model: evaluation metrics, confusion matrix, feature reference, retrain dialog.

- [ ] **Step 3: Replace page API imports with hooks**

Every page uses feature query/mutation hooks. Mutation callbacks show `toast.success` or `toast.error`, close overlays, and invalidate the owning feature keys. Preserve current download filenames and CSV errors.

- [ ] **Step 4: Verify**

Run from `frontend/`: `npm run test`
Run from `frontend/`: `npm run typecheck`
Run from `frontend/`: `npm run build`
Run from `frontend/`: `npm run check:build-secrets`
Run from `frontend/`: `npm run e2e`
Expected: all existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "refactor: extract identity device event audit and model features"
```

### Task 16: Extract access, policies, and incidents features

**Files:**
- Create: `frontend/src/features/access/{api.ts,queries.ts,model.ts,pages/AccessDecisionsPage.tsx,components/}`
- Create: `frontend/src/features/policies/{api.ts,queries.ts,model.ts,pages/PoliciesPage.tsx,components/}`
- Create: `frontend/src/features/incidents/{api.ts,queries.ts,model.ts,pages/IncidentsPage.tsx,components/}`
- Delete: corresponding old pages after verification

**Interfaces:**
- Consumes: feature hooks, shared UI, `lib/http.ts`, query cache.
- Produces: the three largest pages split into testable sections without changing behavior.

- [ ] **Step 1: Create feature APIs**

```typescript
// features/access/api.ts
export function listAccessRequests(params: ListParams) { return request<Page<AccessRequest>>(`/access-requests${buildQuery(params)}`); }
export function getAccessRequest(requestId: string) { return request<AccessRequestDetail>(`/access-requests/${requestId}`); }
export function evaluateAccess(payload: EvaluateAccessPayload) { return request<DecisionResult>("/access-requests/evaluate", { method: "POST", body: payload }); }
export function exportAccessRequests(params: ListParams) { return download(`/access-requests/export.csv${buildQuery(params)}`, "aegis-access-requests.csv"); }

// features/policies/api.ts
export function listResources(params?: ListParams) { return request<ResourcePolicy[]>(`/resources${buildQuery(params)}`); }
export function getPolicyHistory(resourceId: string) { return request<Policy[]>(`/resources/${resourceId}/policies`); }
export function updatePolicy(resourceId: string, draft: PolicyDraft) { return request<Policy>(`/resources/${resourceId}/policy`, { method: "PUT", body: draft }); }
export function previewPolicy(draft: PolicyDraft, cases: PolicyPreviewCase[]) { return request<PolicyPreview>("/policies/preview", { method: "POST", body: { draft, cases } }); }

// features/incidents/api.ts
export function listIncidents(params: ListParams) { return request<Page<Incident>>(`/incidents${buildQuery(params)}`); }
export function getIncident(incidentId: string) { return request<IncidentDetail>(`/incidents/${incidentId}`); }
export function updateIncident(incidentId: string, payload: IncidentUpdate) { return request<IncidentDetail>(`/incidents/${incidentId}`, { method: "PATCH", body: payload }); }
export function addIncidentNote(incidentId: string, note: string) { return request<IncidentNote>(`/incidents/${incidentId}/notes`, { method: "POST", body: { note } }); }
```

- [ ] **Step 2: Move access models and split the page**

Move filter defaults, query-param parsing, presets, feature form defaults, decision formatting, and download helpers into `features/access/model.ts`. Split `AccessDecisionsPage` into filter bar, request table, decision detail drawer, evaluate dialog, behavior form, and result view.

- [ ] **Step 3: Move policy models and split the page**

Move draft conversion, validation, role/device options, preview cases, and diff helpers into `features/policies/model.ts`. Split `PoliciesPage` into resource list, policy detail, editor, version history, preview dialog, and preview results.

- [ ] **Step 4: Move incident models and split the page**

Move filter defaults, assignment options, detail formatting, and mutation payload builders into `features/incidents/model.ts`. Split `IncidentsPage` into filters, table, detail drawer, status editor, assignment, note composer, and timeline.

- [ ] **Step 5: Verify**

Run from `frontend/`: `npm run test`
Run from `frontend/`: `npm run typecheck`
Run from `frontend/`: `npm run build`
Run from `frontend/`: `npm run check:build-secrets`
Run from `frontend/`: `npm run e2e`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src
git commit -m "refactor: extract access policy and incident features"
```

### Task 17: Add realtime invalidation registry and remove frontend compatibility layers

**Files:**
- Create: `frontend/src/app/realtime.ts`
- Create: `frontend/src/app/useRealtime.ts`
- Create: `frontend/src/types/api.ts` (rewritten from generated schemas)
- Rewrite: `frontend/src/types/api.ts` to alias generated schemas; keep UI-only types handwritten
- Delete: `frontend/src/pages/`, `frontend/src/services/api.ts`, `frontend/src/hooks/queries.ts`, `frontend/src/hooks/useAuth.tsx`, `frontend/src/hooks/useToast.tsx`, `frontend/src/hooks/useTheme.tsx`, and only superseded wire-shape declarations
- Modify: `frontend/src/app/layout/*` imports

**Interfaces:**
- Consumes: feature query keys.
- Produces: central invalidations, generated type aliases, no compatibility imports.

- [ ] **Step 1: Create the invalidation registry**

Each feature exports a `realtimeKeys` value. `app/realtime.ts` composes them:

```typescript
export const realtimeInvalidations = [
  eventKeys.all,
  overviewKeys.all,
  incidentKeys.all,
  notificationKeys.all,
  identityKeys.all,
];

export function invalidateRealtimeData(queryClient: QueryClient): void {
  for (const queryKey of realtimeInvalidations) {
    queryClient.invalidateQueries({ queryKey });
  }
}
```

`useRealtime` preserves the current reconnect delays, heartbeat, malformed-frame handling, `4401` behavior, and last-event state.

- [ ] **Step 2: Replace wire duplicates with generated aliases**

```typescript
import type { components } from "./generated/openapi";

type Schemas = components["schemas"];

export type Me = Schemas["MeOut"];
export type IdentitySummary = Schemas["IdentitySummary"];
export type IdentityDetail = Schemas["IdentityDetail"];
export type Device = Schemas["DeviceOut"];
export type AccessRequest = Schemas["AccessRequestOut"];
export type AccessRequestDetail = Schemas["AccessRequestDetail"];
export type AuditEntry = Schemas["AuditOut"];
export type AuditVerify = Schemas["AuditVerifyOut"];
export type Policy = Schemas["PolicyOut"];
export type ResourcePolicy = Schemas["ResourcePolicyOut"];
export type SecurityEvent = Schemas["SecurityEventOut"];
export type Notification = Schemas["NotificationOut"];
export type Incident = Schemas["IncidentOut"];
export type IncidentDetail = Schemas["IncidentDetail"];
export type IncidentNote = Schemas["IncidentNoteOut"];
export type Overview = Schemas["OverviewOut"];
export type HealthStatus = Schemas["HealthStatus"];
export type ModelEvaluation = Schemas["ModelEvaluationOut"];
export type SettingsInfo = Schemas["SettingsInfoOut"];
export type DemoScenarioInfo = Schemas["DemoScenarioInfo"];
export type DemoRun = Schemas["DemoRunOut"];
export type DemoReset = Schemas["DemoResetOut"];
export type DecisionResult = Schemas["DecisionOut"];
```

Keep UI-only types handwritten: `Page<T>`, `ListParams`, `FeatureMetadata`, request payload helpers, and view models. Preserve unions through aliases such as `export type Role = Me["role"]`. Remove any UI-only field not returned by the API unless a feature explicitly adds it in its own model.

- [ ] **Step 3: Remove compatibility files**

Delete old `pages/`, `services/api.ts`, and aggregate `hooks/queries.ts` only after all imports use feature/app modules. Keep `components/ui` as the public shared UI entrypoint; do not delete the UI barrel.

- [ ] **Step 4: Verify no stale imports**

Run: `Get-ChildItem frontend\src -Recurse -Include *.ts,*.tsx | Select-String -Pattern 'services/api|hooks/queries|hooks/useAuth|hooks/useToast|hooks/useTheme|/pages/'`
Expected: no output.

- [ ] **Step 5: Run checks**

Run from `frontend/`: `npm run test`
Run from `frontend/`: `npm run typecheck`
Run from `frontend/`: `npm run build`
Run from `frontend/`: `npm run check:build-secrets`
Run from `frontend/`: `npm run e2e`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src
git commit -m "refactor: remove frontend compatibility layers"
```

### Task 18: Remove backend compatibility layers and add boundary checks

**Files:**
- Delete: `backend/app/api/{access,audit,auth,demo,devices,events,health,identities,incidents,model,overview,policies,settings}.py`
- Delete: `backend/app/services/`, `backend/app/audit/`, `backend/app/policies/`, `backend/app/serializers.py`
- Delete: `backend/app/schemas.py` after moving `Page`/error shapes to `api/schemas.py`
- Delete: `backend/app/models.py` after updating every import to `app.db.models`
- Create: `backend/scripts/check_boundaries.py`
- Create: `backend/tests/test_import_boundaries.py`
- Modify: `backend/app/main.py`, `backend/app/core/database.py`, `backend/alembic/env.py`, `backend/scripts/check.py`, `backend/scripts/bootstrap.py`, `.github/workflows/ci.yml`
- Modify tests that still import compatibility paths: `conftest.py`, `test_health.py`, `test_access_service.py`, `test_policies.py`, `test_policy_engine.py`, `test_bootstrap.py`, `test_events_incidents.py`, `test_overview_audit_model.py`, and any other `app.models`/`app.api.*`/`app.services.*`/`app.audit.*`/`app.policies.*`/`app.seed` imports

**Interfaces:**
- Consumes: completed backend domains.
- Produces: executable import/layering guard and no temporary re-exports.

- [ ] **Step 1: Remove compatibility modules**

Delete every `# TEMP-COMPAT` module and update all imports to domain paths. Keep only `app/api/{router.py,deps.py,schemas.py}` under `api/`. Keep `app/core`, `app/db`, `app/security`, `app/ml`, `app/realtime`, `app/seed`.

- [ ] **Step 2: Write the boundary checker**

```python
from __future__ import annotations

import ast
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app"
ERRORS: list[str] = []


def parse(path: Path) -> tuple[set[str], ast.AST]:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    found: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module:
            found.add(node.module)
        elif isinstance(node, ast.Import):
            found.update(alias.name for alias in node.names)
    return found, tree


def uses_sqlalchemy(modules: set[str]) -> bool:
    return any(module == "sqlalchemy" or module.startswith("sqlalchemy.") for module in modules)


def calls_transaction(tree: ast.AST) -> bool:
    return any(
        isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and node.func.attr in {"commit", "rollback"}
        for node in ast.walk(tree)
    )


def check() -> None:
    for path in APP.rglob("*.py"):
        rel = path.relative_to(APP).as_posix()
        modules, tree = parse(path)
        if rel.endswith("/router.py") or rel == "router.py":
            if uses_sqlalchemy(modules) or calls_transaction(tree):
                ERRORS.append(f"{rel}: routers must not contain SQL or transactions")
            imports_domain_router = any(
                module.startswith("app.domains.") and module.endswith(".router")
                for module in modules
            )
            if rel != "api/router.py" and imports_domain_router:
                ERRORS.append(f"{rel}: routers must not import other routers")
        if rel.startswith(("core/", "db/", "security/", "ml/", "realtime/")):
            if any(module.startswith("app.domains") for module in modules):
                ERRORS.append(f"{rel}: shared modules must not import domains")


if __name__ == "__main__":
    check()
    print("\n".join(ERRORS))
    raise SystemExit(1 if ERRORS else 0)
```

- [ ] **Step 3: Add the test**

```python
from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def test_backend_import_boundaries():
    root = Path(__file__).resolve().parents[1]
    result = subprocess.run(
        [sys.executable, "scripts/check_boundaries.py"],
        cwd=root,
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
```

- [ ] **Step 4: Wire verification**

Add `scripts/check_boundaries.py` to `backend/scripts/check.py` and CI. The checker must scan all backend Python files, including tests only if they import domains incorrectly in shared layers.

- [ ] **Step 5: Verify backend**

Run from `backend/`: `.\.venv\Scripts\python.exe scripts\check_boundaries.py`
Run from `backend/`: `.\.venv\Scripts\python.exe -m pytest -q`
Run from `backend/`: `.\.venv\Scripts\python.exe -m compileall -q app scripts`
Run from `backend/`: `.\.venv\Scripts\alembic.exe check`
Expected: no violations; all tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend
git commit -m "refactor: remove backend compatibility layers and enforce boundaries"
```

### Task 19: Remove frontend dead code, enforce strict imports, and confirm no drift

**Files:**
- Create: `frontend/scripts/check-boundaries.mjs`
- Modify: `frontend/tsconfig.json`
- Modify: `frontend/package.json`
- Modify: `.github/workflows/ci.yml`
- Delete: proven-unused exports/files only

**Interfaces:**
- Consumes: completed frontend features.
- Produces: `npm run lint:boundaries`, strict unused checks, and CI drift gates.

- [ ] **Step 1: Add the frontend boundary checker**

```javascript
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = "src";
const errors = [];
const files = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(ts|tsx)$/.test(path)) files.push(path);
  }
}

walk(root);

for (const file of files) {
  const rel = relative(root, file).replaceAll("\\", "/");
  const source = readFileSync(file, "utf8");
  if (rel !== "config/env.ts" && source.includes("import.meta.env")) {
    errors.push(`${rel}: import.meta.env is only allowed in config/env.ts`);
  }
  if (rel.includes("/pages/") && /from ["'][^"']*(lib\/http|services\/api)/.test(source)) {
    errors.push(`${rel}: pages must not import raw HTTP modules`);
  }
  if (/^(components|lib|config|types)\//.test(rel) && /from ["'][^"']*features\//.test(source)) {
    errors.push(`${rel}: shared modules must not import features`);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`Boundary check passed for ${files.length} files.`);
```

- [ ] **Step 2: Add scripts and strict compiler flags**

```json
{
  "scripts": {
    "lint:boundaries": "node scripts/check-boundaries.mjs"
  }
}
```

Set `"noUnusedLocals": true` and `"noUnusedParameters": true` in `tsconfig.json`. Fix every reported unused symbol or remove it with evidence.

- [ ] **Step 3: Add CI gates**

In the frontend CI job add:

```yaml
      - name: Check generated API types
        run: npm run api:check
      - name: Check import boundaries
        run: npm run lint:boundaries
```

- [ ] **Step 4: Run evidence-based deletion**

Search each candidate export with `grep`, confirm no imports, then delete. Keep public UI primitives, feature APIs, and types used by tests. Do not delete code based only on visual scanning.

- [ ] **Step 5: Verify frontend**

Run from `frontend/`: `npm run lint:boundaries`
Run from `frontend/`: `npm run api:check`
Run from `frontend/`: `npm run typecheck`
Run from `frontend/`: `npm run test`
Run from `frontend/`: `npm run build`
Run from `frontend/`: `npm run check:build-secrets`
Run from `frontend/`: `npm run e2e`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add frontend .github/workflows/ci.yml
git commit -m "refactor: enforce frontend boundaries and remove dead code"
```

### Task 20: Document the architecture and run final verification

**Files:**
- Create: `docs/CODEBASE.md`
- Create: `docs/CONVENTIONS.md`
- Create: `docs/CONFIGURATION.md`
- Create: `docs/decisions/0001-feature-first-modular-monolith.md`
- Create: `backend/app/domains/README.md`
- Create: `frontend/src/features/README.md`
- Modify: `README.md`, `docs/ARCHITECTURE.md`, `docs/API.md`, `docs/THREAT_MODEL.md`, `docs/DEMO_GUIDE.md`
- Modify: `docs/superpowers/specs/2026-10-27-aegis-refactor-design.md` status to `Approved`

**Interfaces:**
- Consumes: final code structure and verified contracts.
- Produces: architecture map, conventions, configuration reference, ADR, domain maps, and final evidence.

- [ ] **Step 1: Write the required documentation**

- `CODEBASE.md`: directory map, request lifecycle, dependency rules, where to add a backend domain/frontend feature, request/response flow, realtime flow, and test commands.
- `CONVENTIONS.md`: naming, layering, state ownership, errors, config, generated types, CSV exports, accessibility, testing, and import rules.
- `CONFIGURATION.md`: every `AEGIS_*` and `VITE_*` variable, default, production requirement, secret-handling rule, and an explicit note that `VITE_*` is public.
- ADR: modular-monolith rationale, feature-first choice, trade-offs, rejected alternatives, and migration approach.
- Domain maps: one-line responsibility and allowed dependencies for each backend domain and frontend feature.

- [ ] **Step 2: Update existing docs**

Update route lists only if operation IDs or paths did not change (they should not). Update architecture diagrams/links, module ownership, configuration, security boundaries, generated-type workflow, and demo instructions. Keep known limitations accurate: Docker/PostgreSQL unverified; SQLite is the tested local database.

- [ ] **Step 3: Run the complete backend suite**

From `backend/`:

```powershell
.\.venv\Scripts\python.exe -m compileall -q app scripts
.\.venv\Scripts\python.exe scripts\check_boundaries.py
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\alembic.exe upgrade head
.\.venv\Scripts\alembic.exe check
.\.venv\Scripts\python.exe -m pip_audit -r requirements.txt
```

Expected: all pass; tests `>=79`.

- [ ] **Step 4: Run the complete frontend suite**

From `frontend/`:

```powershell
npm run typecheck
npm run test
npm audit --audit-level=moderate
npm run api:check
npm run lint:boundaries
npm run build
npm run check:build-secrets
npm run e2e
```

Expected: typecheck/tests/build/secret scan pass; npm audit has no moderate-or-higher issues; generated types match; boundaries pass; all 3 Playwright tests pass.

- [ ] **Step 5: Verify the OpenAPI contract**

Run: `backend\.venv\Scripts\python.exe backend\scripts\export_openapi.py`
Run: `git diff --exit-code -- frontend/openapi.json frontend/src/types/generated/openapi.d.ts`
Expected: no diff.

- [ ] **Step 6: Perform the manual behavior checklist**

Verify demo login for all four roles, employee containment, access evaluation, policy preview/update, incident update/note, CSV exports, realtime reconnect, and audit verification. Record any manually verified item; do not claim Docker/PostgreSQL verification.

- [ ] **Step 7: Commit documentation and final changes**

```bash
git add docs README.md backend/app/domains/README.md frontend/src/features/README.md docs/superpowers/specs/2026-10-27-aegis-refactor-design.md
git commit -m "docs: document modular architecture and verification"
```

## Completion Evidence

Record in the final response:

- Baseline commit and final commit hashes.
- Backend test count and commands that passed.
- Frontend test count and commands that passed.
- OpenAPI drift and boundary-check results.
- Playwright result.
- Manual flows verified.
- Explicit statement that Docker/PostgreSQL was not verified if still unavailable.
