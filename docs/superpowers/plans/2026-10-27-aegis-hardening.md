# AEGIS NEXUS AI Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for every behavior change. Execute inline unless a task is fully independent. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Harden AEGIS NEXUS AI without changing its product architecture: close security gaps, make production mode fail closed, add accessibility and CI, upgrade vulnerable tooling, and keep the demo working.

**Architecture:** Retain FastAPI + SQLAlchemy + React/Vite. Add targeted middleware/config guards, an explicit bootstrap path, reusable dialog focus management, runtime/dev dependency separation, and CI gates. No rewrite, no new runtime services.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.0.36, Alembic, pytest; React 18, TypeScript, Vite 8, Vitest 5, Playwright, npm; GitHub Actions.

**Spec:** Approved 2026-10-27 hardening design (captured in the constraints and tasks below).

## Global Constraints

- Do not change the policy decision order or ML’s escalation-only guarantee.
- Keep `SQLAlchemy==2.0.36`; do not upgrade to 2.1.x on this Windows environment.
- Keep `aegis_session` HttpOnly and `aegis_csrf` readable; double-submit requires it.
- Never put a real secret in a `VITE_*` variable. The demo password is demo-only.
- Local path is Windows; use `npm.cmd`, `.\\.venv\\Scripts\\python.exe`, and no `rg`.
- Docker is unavailable locally. Docker/PostgreSQL remain explicitly unverified until CI or a Docker host runs them.
- No git repository exists. Do not attempt commits.
- Keep existing API paths, role names, cookie names, and decision semantics.
- Production mode must never seed demo accounts or accept insecure cookies.

---

### Task 1: Enforce CSRF for stale sessions

**Files:**
- Modify: `backend/app/security/csrf.py`
- Create: `backend/tests/test_csrf.py`

**Interfaces:**
- Consumes: `resolve_session(db, raw_token)`, `SESSION_COOKIE`, `CSRF_COOKIE`.
- Produces: unchanged middleware class; stricter behavior when either cookie exists.

- [x] **Step 1: Write failing tests**

```python
from app.models import UserSession
from tests.conftest import login
from sqlalchemy import select


def test_stale_session_cookie_still_requires_csrf(client, admin_identity):
    csrf = login(client, admin_identity.email)
    assert client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf}).status_code == 200
    client.cookies.set("aegis_session", "stale-session")
    client.cookies.set("aegis_csrf", "stale-csrf")
    response = client.post("/api/auth/logout")
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "CSRF_VALIDATION_FAILED"


def test_stale_session_with_matching_double_submit_reaches_auth(client, admin_identity):
    login(client, admin_identity.email)
    client.cookies.set("aegis_session", "stale-session")
    client.cookies.set("aegis_csrf", "stale-csrf")
    response = client.post("/api/auth/logout", headers={"X-CSRF-Token": "stale-csrf"})
    assert response.status_code == 401


def test_active_session_rejects_double_submit_not_bound_to_session(client, admin_identity, db):
    login(client, admin_identity.email)
    client.cookies.set("aegis_csrf", "attacker-token")
    response = client.post("/api/auth/logout", headers={"X-CSRF-Token": "attacker-token"})
    assert response.status_code == 403


def test_anonymous_unsafe_request_is_not_treated_as_csrf_failure(client):
    response = client.post("/api/auth/logout")
    assert response.status_code == 401
```

- [x] **Step 2: Run tests and verify RED**

Run: `.\\.venv\\Scripts\\python.exe -m pytest tests/test_csrf.py -q`
Expected: the first three fail because the stale session bypasses CSRF.

- [x] **Step 3: Implement minimal middleware**

```python
raw_session = request.cookies.get(SESSION_COOKIE)
cookie_token = request.cookies.get(CSRF_COOKIE)
if raw_session or cookie_token:
    header_token = request.headers.get("X-CSRF-Token")
    if not header_token or not cookie_token or header_token != cookie_token:
        return _csrf_failure()
    if raw_session:
        db = SessionLocal()
        try:
            session = resolve_session(db, raw_session)
        finally:
            db.close()
        if session is not None and header_token != session.csrf_token:
            return _csrf_failure()
```

Extract `_csrf_failure()` returning the existing 403 JSON response.

- [x] **Step 4: Verify GREEN and full backend suite**

Run: `.\\.venv\\Scripts\\python.exe -m pytest -q`
Expected: all existing and new tests pass.

### Task 2: Production config guard and safe bootstrap

**Files:**
- Modify: `backend/app/core/config.py`
- Modify: `backend/app/main.py`
- Create: `backend/scripts/bootstrap.py`
- Modify: `backend/scripts/seed_demo.py`
- Create: `backend/tests/test_config.py`
- Create: `backend/tests/test_bootstrap.py`
- Modify: `backend/.env.example` or root `.env.example`

**Interfaces:**
- Produces: `validate_runtime_settings(settings: Settings) -> None`
- Produces: `ensure_bootstrap_admin(db: Session, settings: Settings) -> bool`
- Adds settings: `bootstrap_admin_email`, `bootstrap_admin_password`, `bootstrap_admin_name`.

- [x] **Step 1: Write failing config tests**

```python
import pytest
from app.core.config import Settings, validate_runtime_settings


def test_production_rejects_insecure_cookies():
    settings = Settings(
        _env_file=None,
        environment="production",
        demo_mode=False,
        cookie_secure=False,
        allowed_origins="https://aegis.example.com",
    )
    with pytest.raises(ValueError, match="AEGIS_COOKIE_SECURE"):
        validate_runtime_settings(settings)


def test_production_rejects_demo_mode_and_wildcard_cors():
    settings = Settings(
        _env_file=None,
        environment="production",
        demo_mode=True,
        cookie_secure=True,
        allowed_origins="*",
    )
    with pytest.raises(ValueError, match="demo mode"):
        validate_runtime_settings(settings)


def test_valid_production_configuration_passes():
    settings = Settings(
        _env_file=None,
        environment="production",
        demo_mode=False,
        cookie_secure=True,
        allowed_origins="https://aegis.example.com",
        bootstrap_admin_email="admin@aegis.example.com",
        bootstrap_admin_password="A-long-bootstrap-password-2026",
    )
    validate_runtime_settings(settings)
```

- [x] **Step 2: Run RED**

Run: `.\\.venv\\Scripts\\python.exe -m pytest tests/test_config.py -q`
Expected: import/attribute failure for `validate_runtime_settings`.

- [x] **Step 3: Implement production guard**

```python
def validate_runtime_settings(settings: Settings) -> None:
    if not settings.is_development:
        if not settings.cookie_secure:
            raise ValueError("AEGIS_COOKIE_SECURE must be true outside development.")
        if settings.demo_mode:
            raise ValueError("Demo mode must be disabled outside development.")
        if "*" in settings.allowed_origin_list:
            raise ValueError("Wildcard CORS origins are not allowed outside development.")
```

Call it in `lifespan` before `init_db()`.

- [x] **Step 4: Write failing bootstrap tests**

```python
from app.core.config import Settings
from app.seed import seed_demo_data
from app.scripts_bootstrap import ensure_bootstrap_admin
from app.models import Identity
from sqlalchemy import select


def test_production_bootstrap_requires_admin_credentials(db):
    settings = Settings(_env_file=None, environment="test", demo_mode=False)
    with pytest.raises(ValueError, match="bootstrap"):
        ensure_bootstrap_admin(db, settings)


def test_production_bootstrap_creates_only_an_admin(db):
    settings = Settings(
        _env_file=None,
        environment="test",
        demo_mode=False,
        bootstrap_admin_email="admin@aegis.example.com",
        bootstrap_admin_password="A-long-bootstrap-password-2026",
        bootstrap_admin_name="Bootstrap Admin",
    )
    assert ensure_bootstrap_admin(db, settings) is True
    identities = list(db.scalars(select(Identity)))
    assert len(identities) == 1
    assert identities[0].role == "SECURITY_ADMIN"
    assert identities[0].email == settings.bootstrap_admin_email
```

- [x] **Step 5: Implement bootstrap and seed guard**

Create `backend/scripts/bootstrap.py` importing `ensure_bootstrap_admin` from an app module, or create `backend/app/services/bootstrap.py` and keep the script thin. The script must:
- seed demo data when `demo_mode` is true;
- require non-empty bootstrap email/password when false;
- create one `SECURITY_ADMIN` only when the identity table is empty;
- never overwrite an existing admin.

`scripts/seed_demo.py` must exit non-zero with a clear message if `demo_mode` is false.

- [x] **Step 6: Verify GREEN**

Run: `.\\.venv\\Scripts\\python.exe -m pytest tests/test_config.py tests/test_bootstrap.py -q`
Expected: pass.

### Task 3: Remove demo credentials from production frontend builds

**Files:**
- Modify: `frontend/src/pages/LoginPage.tsx`
- Create: `frontend/scripts/check-build-secrets.mjs`
- Modify: `frontend/package.json`
- Modify: `frontend/Dockerfile`
- Modify: `docker-compose.yml`

**Interfaces:**
- Produces: `npm run check:build-secrets` exits 1 if the default demo password is present in `dist/assets/*.js`.
- `VITE_DEMO_MODE=false` hides the demo account chooser.

- [x] **Step 1: Make demo configuration production-safe**

```ts
const DEMO_ENABLED =
  import.meta.env.VITE_DEMO_MODE === "true" ||
  (import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE !== "false");
const DEMO_PASSWORD =
  import.meta.env.VITE_DEMO_PASSWORD ??
  (import.meta.env.DEV && DEMO_ENABLED ? "ChangeMe-Demo!2026" : "");
```

Use `useState(DEMO_PASSWORD)` and only fill the password from `chooseAccount` when `DEMO_PASSWORD` is non-empty.

- [x] **Step 2: Add the build guard**

```js
import { readFileSync, readdirSync } from "node:fs";

const needle = process.env.VITE_DEMO_PASSWORD ?? "ChangeMe-Demo!2026";
const files = readdirSync("dist/assets").filter((file) => file.endsWith(".js"));
const leaked = files.filter((file) => readFileSync(`dist/assets/${file}`, "utf8").includes(needle));
if (leaked.length) {
  console.error(`Demo password found in production assets: ${leaked.join(", ")}`);
  process.exit(1);
}
```

Add: `"check:build-secrets": "node scripts/check-build-secrets.mjs"`.

- [x] **Step 3: Verify production build excludes the secret**

Run:
```powershell
$env:VITE_DEMO_MODE="false"; $env:VITE_DEMO_PASSWORD=""
npm.cmd run build
npm.cmd run check:build-secrets
```
Expected: build succeeds; guard exits 0. If the literal survives tree-shaking, replace the default literal with a value loaded only from `VITE_DEMO_PASSWORD`.

- [x] **Step 4: Wire Docker**

Add `ARG VITE_DEMO_MODE` and `ARG VITE_DEMO_PASSWORD`, export them for the build, and pass them from Compose. Production deployments must set `VITE_DEMO_MODE=false` and omit the password.

### Task 4: Request logging, readiness, and WebSocket revalidation

**Files:**
- Create: `backend/app/core/logging.py`
- Modify: `backend/app/main.py`
- Modify: `backend/app/api/health.py`
- Modify: `backend/app/api/events.py`
- Create: `backend/tests/test_runtime.py`
- Create: `backend/tests/test_websocket.py`

**Interfaces:**
- Produces: `X-Request-ID` response header.
- Produces: `GET /api/health/ready` -> 200 when DB responds, 503 otherwise.
- WebSocket closes with code `4401` after session revocation.

- [x] **Step 1: Write failing runtime tests**

```python
def test_responses_include_request_id(client):
    response = client.get("/api/health")
    assert response.headers["X-Request-ID"]


def test_readiness_fails_closed_when_database_is_unavailable(client, monkeypatch):
    import app.api.health as health_module
    monkeypatch.setattr(health_module, "database_is_available", lambda: False)
    response = client.get("/api/health/ready")
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "NOT_READY"
```

- [x] **Step 2: Write failing WebSocket test**

```python
from starlette.websockets import WebSocketDisconnect
from app.core.database import SessionLocal
from app.models import UserSession
from sqlalchemy import select


def test_websocket_revalidates_revoked_session(client, admin_identity):
    login(client, admin_identity.email)
    with client.websocket_connect("/api/ws/events") as websocket:
        assert websocket.receive_json()["type"] == "connected"
        with SessionLocal() as db:
            for session in db.scalars(select(UserSession)):
                session.revoked_at = __import__("app.models", fromlist=["utcnow"]).utcnow()
            db.commit()
        websocket.send_text("ping")
        with pytest.raises(WebSocketDisconnect) as exc:
            websocket.receive_json()
        assert exc.value.code == 4401
```

- [x] **Step 3: Run RED**

Run: `.\\.venv\\Scripts\\python.exe -m pytest tests/test_runtime.py tests/test_websocket.py -q`
Expected: missing header/readiness endpoint; WebSocket stays open.

- [x] **Step 4: Implement**

- Add request-ID middleware and structured request/exception logging.
- Add `/health/ready` that checks `database_is_available()` and returns `ApiError(503, "NOT_READY", ...)`.
- On every WebSocket `ping`/`heartbeat`, resolve the captured raw session token again; close `4401` if invalid or the identity is not an active staff role.

- [x] **Step 5: Verify GREEN**

Run: `.\\.venv\\Scripts\\python.exe -m pytest -q`
Expected: all pass.

### Task 5: Upgrade vulnerable dependencies and split runtime packages

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/requirements-dev.txt`
- Modify: `backend/Dockerfile`
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Modify: `backend/pyproject.toml` if pytest config lives there

**Interfaces:**
- Runtime image installs only production Python packages.
- CI installs `requirements-dev.txt`.

- [x] **Step 1: Split Python dependencies**

`requirements.txt`: fastapi, uvicorn, sqlalchemy==2.0.36, pydantic, pydantic-settings, alembic, scikit-learn, pandas, numpy, joblib, psycopg.

`requirements-dev.txt`:
```text
-r requirements.txt
httpx>=0.28.0,<1.0.0
pytest>=9.0.3,<10.0.0
pytest-cov>=6.0.0,<7.0.0
```

- [x] **Step 2: Upgrade frontend majors**

Run:
```powershell
cd frontend
npm.cmd install react-router-dom@^7.18.4
npm.cmd install -D vite@^8.3.5 vitest@^5.0.5 @vitejs/plugin-react@latest @playwright/test@latest jsdom@latest
npm.cmd audit
```
Expected: no high/critical advisories. If React Router 7 breaks an API, adapt imports and rerun all frontend tests.

- [x] **Step 3: Verify frontend**

Run: `npm.cmd test; npm.cmd run typecheck; npm.cmd run build`
Expected: all pass.

- [x] **Step 4: Verify Python**

Run:
```powershell
cd ..\backend
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m pip_audit -r requirements.txt
```
Expected: tests pass; runtime audit clean.

### Task 6: Accessibility and focus management

**Files:**
- Create: `frontend/src/hooks/useDialogFocus.ts`
- Create: `frontend/src/hooks/useDialogFocus.test.tsx`
- Modify: `frontend/src/components/layout/CommandPalette.tsx`
- Modify: `frontend/src/components/layout/Sidebar.tsx`
- Modify: `frontend/src/components/layout/AppShell.tsx`
- Create: `frontend/e2e/accessibility.spec.ts`
- Modify: `frontend/package.json` for `@axe-core/playwright`

**Interfaces:**
- Produces: `useDialogFocus<T extends HTMLElement>(open, onClose, initialFocus?)` returning a ref.
- Dialog behavior: initial focus, Tab/Shift+Tab trap, Escape close, focus return, scroll lock.

- [x] **Step 1: Write the failing focus test**

```tsx
function Harness() {
  const [open, setOpen] = useState(false);
  const ref = useDialogFocus<HTMLDivElement>(open, () => setOpen(false));
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      {open && (
        <div ref={ref} role="dialog" aria-modal="true" aria-label="Test dialog">
          <button>First</button>
          <button>Second</button>
        </div>
      )}
    </>
  );
}

it("traps focus, closes on Escape, and returns focus", async () => {
  const user = userEvent.setup();
  render(<Harness />);
  const trigger = screen.getByRole("button", { name: "Open" });
  await user.click(trigger);
  expect(screen.getByRole("button", { name: "First" })).toHaveFocus();
  await user.tab();
  expect(screen.getByRole("button", { name: "Second" })).toHaveFocus();
  await user.tab();
  expect(screen.getByRole("button", { name: "First" })).toHaveFocus();
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});
```

- [x] **Step 2: Run RED**

Run: `npm.cmd test -- useDialogFocus`
Expected: missing hook/module.

- [x] **Step 3: Implement the hook and wire both dialogs**

- CommandPalette: attach the ref, keep arrow/Enter handling, remove its duplicate Escape close.
- Sidebar mobile drawer: attach the ref, add `role="dialog"`, `aria-modal="true"`, `aria-label="Primary navigation"`, and Escape close.
- Add `aria-label={`${item.label} — ${item.description}`}` to collapsed NavLinks.
- Add a skip link in AppShell and `id="main-content" tabIndex={-1}` on `<main>`.

- [x] **Step 4: Add axe E2E**

Install `@axe-core/playwright` and assert no `critical` or `serious` violations on login, overview, employee home, the mobile navigation drawer, and the command palette. Fix violations rather than disabling rules. If a contrast token must change, keep the existing visual language and verify both themes.

- [x] **Step 5: Verify GREEN**

Run: `npm.cmd test; npm.cmd run typecheck; npm.cmd run build; npm.cmd run e2e`
Expected: all pass.

### Task 7: CSP, Docker/Alembic hardening, and CI

**Files:**
- Modify: `frontend/nginx.conf`
- Modify: `backend/Dockerfile`
- Modify: `docker-compose.yml`
- Create: `.github/workflows/ci.yml`
- Modify: `frontend/package.json` if a script is needed

**Interfaces:**
- Backend container runs as non-root, applies Alembic migrations, seeds/bootstrap explicitly, then starts Uvicorn.
- CI runs backend, frontend, E2E, audits, and Docker builds.

- [x] **Step 1: Harden nginx**

Add a CSP compatible with the app and Swagger stays on the backend:
```nginx
add_header Content-Security-Policy "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' ws: wss:; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" always;
gzip on;
gzip_types text/css application/javascript application/json image/svg+xml;
```

- [x] **Step 2: Harden the backend image**

- Install `requirements.txt` only.
- Create a non-root `aegis` user and `chown` `/app`.
- CMD: `alembic upgrade head && python -m scripts.bootstrap && { [ -f ml/artifacts/model.joblib ] || python -m scripts.train_model --rows 5000 --seed 42; } && exec uvicorn ...`
- Compose: `init: true`, `AEGIS_AUTO_CREATE_TABLES: "false"`, environment defaults to `development`, frontend build args include `VITE_DEMO_MODE`.

- [x] **Step 3: Add CI**

```yaml
name: ci
on: [push, pull_request]
jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - run: pip install -r backend/requirements-dev.txt pip-audit
      - run: python -m pytest -q
        working-directory: backend
      - run: pip-audit -r requirements.txt
        working-directory: backend
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "24", cache: npm, cache-dependency-path: frontend/package-lock.json }
      - run: npm ci
        working-directory: frontend
      - run: npm run typecheck
        working-directory: frontend
      - run: npm test
        working-directory: frontend
      - run: npm run build
        working-directory: frontend
      - run: npm audit --omit=dev
        working-directory: frontend
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - uses: actions/setup-node@v4
        with: { node-version: "24", cache: npm, cache-dependency-path: frontend/package-lock.json }
      - run: pip install -r requirements-dev.txt
        working-directory: backend
      - run: python -m scripts.train_model --rows 2000 --seed 42
        working-directory: backend
      - run: npm ci
        working-directory: frontend
      - run: npx playwright install --with-deps chromium
        working-directory: frontend
      - run: npm run e2e
        working-directory: frontend
  docker:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker build -f backend/Dockerfile .
      - run: docker build -f frontend/Dockerfile .
```

- [x] **Step 4: Verify locally what is possible**

Run: `npm.cmd run build; npm.cmd run e2e; .\backend\.venv\Scripts\python.exe -m alembic check` from the right directories. Docker build remains unverified locally.

### Task 8: Documentation and final verification

**Files:**
- Modify: `README.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/API.md`
- Modify: `docs/THREAT_MODEL.md`
- Modify: `docs/ML_METHODOLOGY.md`
- Modify: `docs/DEMO_GUIDE.md`
- Create: `SECURITY.md`

**Interfaces:**
- Docs must distinguish verified local behavior from unverified Docker/PostgreSQL behavior.

- [x] **Step 1: Update security and deployment documentation**

Document:
- stricter CSRF behavior;
- production fail-closed settings and bootstrap admin variables;
- demo-mode build gating;
- readiness/logging/CSP;
- focus/accessibility behavior;
- dependency upgrades and audit status;
- remaining limitations: single-process rate limit, DB admin can rewrite audit chain, no MFA/SSO/SIEM, Docker unverified locally.

- [x] **Step 2: Run the full verification suite**

```powershell
cd backend
.\.venv\Scripts\python.exe scripts\check.py
.\.venv\Scripts\python.exe -m pip_audit -r requirements.txt

cd ..\frontend
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
npm.cmd run check:build-secrets
npm.cmd run e2e
npm.cmd audit --omit=dev

cd ..
$env:AEGIS_DATABASE_URL="sqlite:///$($env:TEMP -replace '\\','/')/aegis-final.db"
cd backend
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m alembic check
```

Expected: every command passes. Record exact counts. Do not claim Docker or PostgreSQL verification.
