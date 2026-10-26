# AEGIS NEXUS AI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a runnable, tested zero-trust security operations prototype with deterministic policy enforcement, real Isolation Forest anomaly detection, explainable decisions, live events, and a premium React interface.

**Architecture:** A single FastAPI application owns authentication, authorization, policy evaluation, anomaly inference, audit, and REST/WebSocket APIs. SQLAlchemy persists to SQLite for local use and PostgreSQL in Docker. A Vite/React SPA uses TanStack Query and a shared design system. The ML training pipeline is separate from runtime inference and never participates in authorization.

**Tech Stack:** Python 3.12, FastAPI, Pydantic, SQLAlchemy, Alembic, scikit-learn, pandas, NumPy, pytest; React 18, TypeScript, Vite, Tailwind CSS, TanStack Query, React Router, Recharts, Lucide; Vitest/RTL; Playwright; Docker Compose optional.

**Spec:** User-provided AEGIS NEXUS AI specification, 2026-10-26.

## Global Constraints

- Local environment has Python 3.12.10 and Node 24.19; Docker is unavailable, npm scripts are disabled in PowerShell, so use `npm.cmd`.
- Local default database is SQLite; PostgreSQL is documented through Compose. Do not require Redis.
- Authentication uses opaque, hashed session tokens in HttpOnly cookies plus CSRF double-submit tokens.
- Backend authorization is mandatory for every protected route. ML output can raise risk but can never grant access or bypass a denial.
- No secrets, generated datasets, model binaries, or credentials in source control.
- Every demo event is explicitly tagged `is_simulated=true`; all six scenarios use production code paths.
- Do not claim attack probability, enterprise completeness, or device integrity verification beyond simulated attributes.
- Backend tests, frontend tests, and builds must actually be executed before claiming success.

---

### Task 1: Repository foundation and runtime configuration

**Files:**
- Create: `.gitignore`, `.env.example`, `README.md`, `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile`, `backend/pyproject.toml`, `backend/requirements.txt`, `frontend/package.json`, `frontend/vite.config.ts`, `frontend/tailwind.config.ts`, `frontend/postcss.config.js`, `frontend/tsconfig*.json`, `frontend/index.html`
- Create: `backend/app/main.py`, `backend/app/core/config.py`, `backend/app/core/database.py`, `backend/app/api/health.py`

**Interfaces:**
- Produces: `Settings` (pydantic-settings) with `database_url`, `allowed_origins`, `demo_mode`, `demo_password`, `session_ttl_minutes`, `cookie_secure`, `model_artifact_dir`; `get_db()` FastAPI dependency; `create_app()`; `GET /api/health` and `GET /api/health/detailed`.

**Acceptance:** Backend starts on SQLite, health endpoints respond, Vite dev server proxies `/api` and `/api/ws`, production builds have no unresolved imports.

### Task 2: Persistent models, authentication, RBAC, and append-only audit

**Files:**
- Create: `backend/app/models/*.py`, `backend/app/schemas/*.py`, `backend/app/security/passwords.py`, `backend/app/security/sessions.py`, `backend/app/api/auth.py`, `backend/app/api/deps.py`, `backend/app/audit/service.py`
- Create: `backend/tests/conftest.py`, `backend/tests/test_auth.py`, `backend/tests/test_authorization.py`, `backend/tests/test_audit.py`

**Interfaces:**
- Models: `Identity`, `Role`, `Resource`, `Device`, `Session`, `AccessRequest`, `BehavioralEvent`, `Incident`, `AccessPolicy`, `PolicyVersion`, `SecurityEvent`, `AuditLog`.
- Roles: `SECURITY_ADMIN`, `SECURITY_ANALYST`, `EMPLOYEE`, `AUDITOR`.
- Produces: scrypt password hashing; `create_session`, `resolve_session`, `revoke_session`; `require_roles(*roles)` dependency; `append_audit(...)` with SHA-256 hash chaining; CSRF validation dependency for unsafe methods.
- Endpoints: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`.

**Acceptance:** Disabled users and wrong passwords fail; protected routes reject anonymous users; role boundaries are enforced server-side; audit records are created and cannot be updated or deleted through ORM/application paths; CSRF is required for state changes.

### Task 3: Identity, device, enrollment, and seed data

**Files:**
- Create: `backend/app/api/identities.py`, `backend/app/api/devices.py`, `backend/app/services/identity_service.py`, `backend/app/services/device_service.py`, `backend/app/seed.py`, `backend/scripts/seed_demo.py`
- Create: `backend/tests/test_identities_devices.py`

**Interfaces:**
- Identity detail includes sessions, access history, behavioral signals, risk history, alerts, audit references.
- Device states: `TRUSTED`, `UNVERIFIED`, `RESTRICTED`, `REVOKED`; transitions require admin and emit events/audit.
- Seed creates a synthetic organization, resources, policies, devices, demo incidents, events, and one account per role.

**Acceptance:** Authorized admins can enroll/revoke devices; analysts/auditors cannot mutate; disabled identities are denied everywhere; demo data is explicitly simulated.

### Task 4: Reproducible ML pipeline and evaluation

**Files:**
- Create: `backend/ml/training/generate_data.py`, `backend/ml/training/train.py`, `backend/ml/evaluation/evaluate.py`, `backend/ml/runtime.py`, `backend/ml/artifacts/.gitkeep`, `backend/tests/test_ml.py`, `backend/scripts/train_model.py`

**Interfaces:**
- Feature schema: `login_hour`, `day_of_week`, `failed_logins_15m`, `requests_1h`, `distinct_resources_1h`, `sensitive_access_ratio`, `new_device`, `geo_novelty`, `session_duration_min`, `activity_deviation`.
- Produces `train_model(seed=...) -> metadata`, `predict(features) -> {anomaly_score, risk_score, risk_category, feature_summary, model_version, timestamp, limitations}`; risk is a normalized anomaly ranking, not calibrated attack probability.
- Held-out split is disjoint; evaluation includes precision, recall, F1, FPR, confusion matrix, ROC-AUC, dataset size/distribution/date.

**Acceptance:** Training is deterministic from seed; artifacts load on startup or bootstrap safely; missing/invalid feature input is rejected; metrics are generated from held-out data; no fabricated percentages.

### Task 5: Deterministic zero-trust decision engine and audit integration

**Files:**
- Create: `backend/app/policies/engine.py`, `backend/app/policies/registry.py`, `backend/app/services/anomaly_service.py`, `backend/app/services/access_service.py`, `backend/app/api/access_requests.py`, `backend/tests/test_policy_engine.py`, `backend/tests/test_access_requests.py`

**Interfaces:**
- Ordered checks: authenticated identity → account active → authorized role → device policy → mandatory restrictions → ML risk thresholds → repeated-anomaly restriction.
- Outcomes: `ALLOW`, `CHALLENGE`, `DENY`, `RESTRICT`; response includes request/resource/action/decision/risk/policy version/reasons/next step/timestamp.
- Every decision appends audit and security events atomically with the access request.
- Low risk can never override inactive identity, missing permission, denied device state, or critical denial rules.

**Acceptance:** All mandatory denial tests pass; risk influences only the remaining allow/challenge/restrict path; decision explanation stored and returned; filters/pagination/search/export work.

### Task 6: Security events, incidents, policy center, model evaluation API, live stream, demo scenarios

**Files:**
- Create: `backend/app/api/events.py`, `backend/app/api/incidents.py`, `backend/app/api/policies.py`, `backend/app/api/model.py`, `backend/app/api/overview.py`, `backend/app/api/audit.py`, `backend/app/api/demo.py`, `backend/app/realtime/manager.py`, `backend/app/services/incident_service.py`, `backend/app/services/policy_service.py`
- Create: `backend/tests/test_incidents_policies.py`, `backend/tests/test_demo.py`, `backend/tests/test_overview.py`

**Interfaces:**
- Policy updates create immutable versions, validate thresholds, and expose non-persisting previews.
- Incidents support Open/Investigating/Contained/Resolved/False Positive with restricted updates, notes, timeline, and audit.
- `GET /api/ws/events` streams typed events with heartbeat; client reconnects and falls back to polling.
- Demo endpoints A–F execute real services; reset is admin-only in demo mode and recreates simulated data.

**Acceptance:** Scenario outcomes are reproducible; false-positive workflow updates incident and audit; unauthorized policy/incident changes fail; overview metrics are all backend-derived and include time ranges; WebSocket survives reconnect.

### Task 7: Frontend foundation and authentication

**Files:**
- Create: `frontend/src/main.tsx`, `App.tsx`, `index.css`, `lib/api.ts`, `lib/query.ts`, `lib/utils.ts`, `types/api.ts`, `hooks/use-auth.ts`, `hooks/use-event-stream.ts`, `components/ui/*`, `components/layout/*`, `pages/LoginPage.tsx`
- Create: `frontend/src/test/setup.ts`, `frontend/src/test/*.test.tsx`, `frontend/vitest.config.ts`

**Interfaces:**
- Semantic color tokens; Inter/JetBrains Mono; collapsible sidebar; top bar with search/filter/notifications/profile/role; accessible focus states.
- `apiGet/apiMutation` include cookies and CSRF; 401 redirects to login; errors surface with safe messages.
- Shared components: Button, Card, Badge, Input, Select, Table, Dialog/Drawer, Skeleton, EmptyState, ErrorState, Tooltip, Pagination, StatCard, RiskBadge.

**Acceptance:** Login/logout work; routes are guarded; navigation is fully functional; loading, empty, error, disconnected, and demo states render; light/dark token support.

### Task 8: All application pages and interactions

**Files:**
- Create: `frontend/src/pages/OverviewPage.tsx`, `IdentityPage.tsx`, `IdentityDetailPage.tsx`, `BehaviorPage.tsx`, `AccessDecisionsPage.tsx`, `IncidentsPage.tsx`, `DevicesPage.tsx`, `PoliciesPage.tsx`, `TimelinePage.tsx`, `AuditPage.tsx`, `ModelPage.tsx`, `SettingsPage.tsx`, `DemoPage.tsx`
- Create feature components under `frontend/src/features/*`

**Interfaces:**
- Overview: metrics, activity/risk/decision charts, risk leaderboard, recent events, health.
- Decisions: filters, pagination, drawer explanation, authorized CSV export.
- Incidents: status workflow, notes; Devices: enroll/revoke; Policies: edit/preview/version history; Timeline: filters + live connection; Audit: filter/export/hash-chain status; Model: honest metrics/limitations; Settings: profile/theme/session info; Demo: run six scenarios/reset.

**Acceptance:** Every sidebar item works; no dead primary buttons; no front-end-only security decisions; responsive tables/charts; unauthorized controls hidden and backend still enforces.

### Task 9: Test and harden end-to-end integration

**Files:**
- Create/Modify: backend tests, frontend tests, `frontend/e2e/security-flows.spec.ts`, `playwright.config.ts`, `.env.example`
- Create: `backend/scripts/check.py`

**Steps:**
1. Run `python -m pytest` and fix failures.
2. Run `npm.cmd run test` and `npm.cmd run build`; fix failures.
3. Start backend/frontend, execute login + six demo scenarios through HTTP, verify expected outcomes and audit rows.
4. Run Playwright if browser installation is available; otherwise document the environment limitation without claiming it passed.
5. Verify health, CORS/cookie/CSRF behavior, role boundaries, demo reset, and no secrets in logs/audit.

**Acceptance:** All executed suites pass; known limitations are recorded; startup commands are verified.

### Task 10: Documentation and final verification

**Files:**
- Create: `README.md`, `docs/ARCHITECTURE.md`, `docs/THREAT_MODEL.md`, `docs/ML_METHODOLOGY.md`, `docs/API.md`, `docs/DEMO_GUIDE.md`, `backend/alembic.ini`, `backend/alembic/env.py`, `backend/alembic/versions/*`

**Acceptance:** Fresh setup, env variables, seed, training, tests, demo credentials, API, limitations, retraining, and security model are documented; no unsupported claims; documented start path verified.
