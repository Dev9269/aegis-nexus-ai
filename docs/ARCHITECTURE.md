# Architecture

## System shape

AEGIS NEXUS AI is a single FastAPI application with a separate React SPA. The API owns all security decisions and persistence. The browser is treated as untrusted presentation.

```text
Browser (React/Vite)
  │  cookies + CSRF header, JSON, WebSocket
  ▼
FastAPI
  ├─ CSRF middleware + security headers
  ├─ role dependencies / session resolution
  ├─ domain services
  │    ├─ access decision engine
  │    ├─ anomaly inference (Isolation Forest)
  │    ├─ incident / policy / device workflows
  │    ├─ append-only audit hash chain
  │    └─ realtime event fan-out
  └─ SQLAlchemy ── SQLite (local) or PostgreSQL (Compose)
         │
         └─ ML artifacts: model.joblib, metadata.json, evaluation.json
```

The model artifact directory is loaded lazily. In development, the runtime can bootstrap a deterministic baseline model when no artifact exists. Outside development it fails closed with `FileNotFoundError`; train explicitly with `python -m scripts.train_model` or the admin retrain endpoint.

Runtime configuration is validated at startup. Outside development, demo mode, insecure cookies, and wildcard CORS are rejected before the app serves traffic. `scripts.bootstrap` seeds demo data only in demo mode; otherwise it creates exactly one explicit administrator and is idempotent.

## Backend modules

| Path | Responsibility |
| --- | --- |
| `app/main.py` | App factory, error envelope, middleware, routers, lifespan |
| `app/core/` | Settings, production guard, database engine/session, structured logging/request IDs, error types |
| `app/security/` | scrypt passwords, hashed sessions, CSRF middleware |
| `app/api/deps.py` | Session resolution and role dependencies |
| `app/api/` | Auth, identities, devices, access, resources/policies, events, incidents, overview, model, audit, settings, health, demo |
| `app/policies/engine.py` | Ordered, deterministic access decision logic |
| `app/services/` | Access orchestration, anomaly scoring, incidents, events, demo orchestration, bootstrap admin |
| `scripts/bootstrap.py` | Explicit demo seed or first-admin bootstrap; never demo data outside demo mode |
| `app/audit/service.py` | SHA-256 chained audit append and verification |
| `app/realtime/` | In-process WebSocket manager with heartbeat |
| `app/seed.py` | Deterministic synthetic organization and initial policies |
| `ml/training/` | Synthetic data generation, training, evaluation |
| `ml/runtime.py` | Artifact loading, prediction, explainability, model metadata |
| `alembic/` | Initial schema migration |

## Access decision flow

Every evaluation uses the same service path whether triggered by the UI or a demo scenario.

1. **Authenticate and resolve** the acting identity/session.
2. **Reject mandatory conditions** in order:
   - inactive/disabled account;
   - inactive resource;
   - missing active policy (secure default: deny);
   - role not authorized;
   - action not authorized;
   - revoked device;
   - device ownership mismatch;
   - device state not allowed;
   - inactive session;
   - session maximum exceeded.
3. **Score behavior** with the Isolation Forest runtime. The model returns a 0–100 anomaly ranking plus top feature deviations.
4. **Apply policy thresholds** to the remaining path:
   - risk `>= deny_threshold` → `DENY`;
   - at least three high-risk anomalies in 30 minutes → `RESTRICT`;
   - risk `>= challenge_threshold` → `CHALLENGE`;
   - otherwise → `ALLOW`.
5. **Persist atomically** the access request, behavioral event details, security event(s), incident effects, audit chain entry, and any session revocation.
6. **Publish** a typed realtime event for staff clients.

`RESTRICT` revokes active identity sessions and records `SESSION_RESTRICTED` plus a `SESSION_REVOKED` audit action. High-risk denials and restrictions create or escalate incidents.

The critical invariant: **low risk cannot bypass a mandatory denial**. Risk can only add friction or containment.

## Roles and boundaries

| Capability | Admin | Analyst | Auditor | Employee |
| --- | --- | --- | --- | --- |
| Personal `/me` | ✓ | ✓ | ✓ | ✓ |
| Own access history | ✓ | ✓ | ✓ | ✓ |
| Staff overview / identities / behavior / events / devices / incidents | ✓ | ✓ | ✓ (read) | — |
| Evaluate access | ✓ | ✓ | — | — |
| Incident updates/notes | ✓ | ✓ | — | — |
| Policy preview | ✓ | ✓ | — | — |
| Publish policy | ✓ | — | — | — |
| Device enrollment/state change | ✓ | — | — | — |
| Model retrain | ✓ | — | — | — |
| Audit list/verify/export | ✓ | ✓ | ✓ | — |
| Demo run | ✓ | ✓ | — | — |
| Demo reset | ✓ | — | — | — |

Identity detail and access list are self-scoped for employees. Staff-only routes are guarded both by the API and by the SPA. Hidden UI is never treated as authorization.

## Session and CSRF model

- Password verification uses scrypt with per-password salts.
- A random session token is returned only as an HttpOnly cookie (`aegis_session`). The database stores a hash of that token.
- A second readable cookie (`aegis_csrf`) carries a CSRF secret. Unsafe requests must repeat it in `X-CSRF-Token`.
- Cookies use `SameSite=Lax`; `Secure` is configurable and required outside development.
- CSRF is enforced whenever a session or CSRF cookie is present, so a stale session cannot bypass the check. A double-submit token that does not match an active session's CSRF secret is rejected.
- Login itself is CSRF-exempt because no session exists yet.
- Logout and expiry return the UI to sign-in; a session notice distinguishes expiry from a cold visit.
- Outside development, startup rejects demo mode, insecure cookies, and wildcard CORS. Demo seeding refuses to run when demo mode is off.

## Audit integrity

Audit rows are append-only in application code. Each row includes:

- monotonically increasing sequence;
- actor and target labels;
- action/result and correlation ID;
- policy version when relevant;
- metadata JSON;
- `prev_hash` and `record_hash`.

`record_hash = SHA-256(canonical row fields + prev_hash)`. `GET /api/audit/verify` recomputes the chain and reports the first break. Demo reset preserves the audit ledger and records the reset action.

## Realtime path

`/api/ws/events` streams `{type: "security_event", event: {...}}` frames plus heartbeats. Staff authorization is checked at connect and revalidated on incoming frames and every `AEGIS_WS_REVALIDATION_SECONDS`; a revoked session closes with code `4401`. The SPA reconnects with backoff and invalidates relevant TanStack Query caches when a frame arrives. High/critical events also surface as toasts. Polling remains available through normal queries if the socket is unavailable.

Every HTTP response carries `X-Request-ID` (supplied when it matches a safe pattern, otherwise generated). Request logs include method, path, status, duration, and request ID; non-development output is JSON. Readiness at `/api/health/ready` checks the database and audit-chain verification and returns `503` when either fails.

## Frontend structure

```text
src/
  App.tsx                 role-aware lazy routes and guards
  main.tsx                BrowserRouter + React root
  components/ui/          shared primitives and security badges
  components/charts/      Recharts wrappers
  components/layout/      shell, sidebar, topbar, command palette
  hooks/                  auth, queries, theme, toast, realtime, dialog focus
  lib/                    role navigation, constants, formatting
  pages/                  one surface per operational area
  services/api.ts         fetch/CSRF/error/download/WebSocket client
  types/api.ts            API contracts
  test/                   jsdom setup
```

Route behavior:

- Unauthenticated visitors → `/login`.
- Employees → `/me`; staff → `/` overview.
- Employees who deep-link to staff routes see an access-boundary state.
- Employees may open only their own identity dossier.
- Access/incident/event deep links use query parameters and open evidence drawers.
- All pages are lazy-loaded; an error boundary prevents a render failure from leaving a blank console.

The command palette and mobile navigation are modal dialogs with focus entry, Tab trapping, Escape close, scroll locking, and focus return to the trigger. This is keyboard-accessibility hardening, not a complete WCAG audit.

## Data model

Core tables: `identities`, `resources`, `devices`, `user_sessions`, `access_policies`, `access_requests`, `behavioral_events`, `incidents`, `incident_notes`, `security_events`, `audit_logs`.

Policies are immutable versions. Publishing creates a new active version, retires the previous one, and audits the change. Access requests retain the evaluated policy version and reasons so evidence remains interpretable after policy changes.

## Deployment topology

Local development:

```text
Vite :5173 ── proxy ──> FastAPI :8000 ──> SQLite file
```

Docker Compose (provided, unverified here):

```text
nginx :8080 ── /api ──> FastAPI :8000 ──> PostgreSQL :5432
```

The frontend container serves static assets with CSP, gzip, no-store HTML, and immutable hashed assets, and proxies `/api` and `/api/ws/`. The API runs as UID 10001 with a read-only filesystem, dropped capabilities, `no-new-privileges`, Alembic migrations, and explicit bootstrap. Published ports bind to loopback. Model artifacts use a named volume and are trained explicitly, not during startup. This topology is a prototype deployment, not an HA production design.
