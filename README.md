# AEGIS NEXUS AI

Adaptive zero-trust access intelligence for a simulated security operations team. AEGIS combines identity, device trust, and behavioral anomaly signals into explainable access decisions — but an Isolation Forest score never grants access. A deterministic policy engine holds the final authority.

> This is a hardened local prototype built for demonstration and review. It is not production-ready, does not prove attacks, and does not perform real device attestation or enterprise SSO. The included controls are a credible baseline, not a certification.

## What ships

- **Zero-trust decision engine** — ordered mandatory controls, risk thresholds, session limits, repeated-anomaly restriction, and explicit reasons.
- **Real Isolation Forest model** — 10 behavioral features, deterministic synthetic training data, disjoint holdout evaluation, and no labels used to fit the model.
- **Explainable results** — risk index, top feature deviations, policy version, reasons, next step, and evidence.
- **Security operations console** — overview, access evidence, identity dossiers, behavioral risk, incidents, timeline, devices, policy studio, model card, audit ledger, settings, and demo lab.
- **Role-aware experience** — admin, analyst, auditor, and employee boundaries enforced by the API and reflected in the UI.
- **Audit and realtime evidence** — append-only SHA-256 hash chain plus a reconnectable WebSocket event stream.
- **Six reproducible scenarios** — allow, step-up, role denial, disabled account, repeated-anomaly containment, and exfiltration-style denial.

## Stack

| Layer | Technology |
| --- | --- |
| API | Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2.0 |
| Data | SQLite locally; PostgreSQL 16 through Docker Compose |
| ML | scikit-learn Isolation Forest, pandas, NumPy, joblib |
| Web | React 18, TypeScript, Vite 8, Tailwind CSS, TanStack Query, Recharts |
| Tests | pytest 9, Vitest 5 + Testing Library, Playwright |

## Quick start (Windows, verified path)

Requirements: Python 3.12, Node 22.12+ (verified with Node 24). Run from the repository root. PowerShell blocks `npm.ps1`; use `npm.cmd`.

```powershell
cd backend

# 1. Create the virtual environment once
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt

# 2. Train the default model (skip if artifacts already exist)
.\.venv\Scripts\python.exe -m scripts.train_model --rows 5000 --seed 42

# 3. Seed the synthetic organization
.\.venv\Scripts\python.exe -m scripts.seed_demo

# 4. Start the API
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

In a second terminal:

```powershell
cd C:\Users\jaina\aegis-nexus-ai\frontend
npm.cmd install
npm.cmd run dev
```

Open <http://127.0.0.1:5173>. Vite proxies `/api` and the WebSocket to port 8000. API docs are at <http://127.0.0.1:8000/api/docs>.

## Demo accounts

The password is `AEGIS_DEMO_PASSWORD`, defaulting to `ChangeMe-Demo!2026`.

| Account | Role | Experience |
| --- | --- | --- |
| `admin@aegisnexus.ai` | Security admin | Full console, policy publishing, enrollment, retraining, demo reset |
| `analyst@aegisnexus.ai` | Security analyst | Evaluate, investigate, ticketing notes, policy preview, demo runs |
| `auditor@aegisnexus.ai` | Auditor | Read-only evidence, audit, model, and exports |
| `maya.chen@aegisnexus.ai` | Employee | Personal posture and own access history only |

Change all demo secrets before exposing the app beyond localhost.

## Six scenarios

Open **Demo scenarios** in the console. Each scenario calls the real services and writes real audit and event records.

| Scenario | Story | Expected outcome |
| --- | --- | --- |
| A | Maya Chen requests a normal finance report from a trusted device | `ALLOW` |
| B | Traveling employee, unusual hour and new context | `CHALLENGE` |
| C | Employee attempts the privileged security console | `DENY` — role not authorized |
| D | Disabled identity attempts access | `DENY` — account disabled |
| E | Repeated high-risk anomalies across three attempts | `CHALLENGE`, `CHALLENGE`, then `RESTRICT`; sessions revoked; incident opened |
| F | Bulk sensitive-resource exfiltration pattern | `DENY`; incident opened |

Use **Reset demo data** as an admin to recreate simulated records. Reset preserves the audit ledger and appends a `DEMO_RESET` audit record.

## Configuration

Copy `.env.example` to `.env` at the repository root. Backend settings use the `AEGIS_` prefix and can also be supplied through the environment.

| Variable | Default | Purpose |
| --- | --- | --- |
| `AEGIS_ENVIRONMENT` | `development` | Runtime environment label |
| `AEGIS_DATABASE_URL` | `sqlite:///./aegis.db` | SQLAlchemy database URL |
| `AEGIS_ALLOWED_ORIGINS` | local Vite origins | CORS allow-list |
| `AEGIS_DEMO_MODE` | `true` | Enables demo credentials/scenarios |
| `AEGIS_DEMO_PASSWORD` | `ChangeMe-Demo!2026` | Seeded demo password |
| `AEGIS_SESSION_TTL_MINUTES` | `60` | Session lifetime |
| `AEGIS_COOKIE_SECURE` | `false` | Set `true` behind HTTPS |
| `AEGIS_AUTO_CREATE_TABLES` | `true` | Create tables at startup |
| `AEGIS_MODEL_ARTIFACT_DIR` | `ml/artifacts` | Model artifact directory |
| `AEGIS_LOGIN_RATE_LIMIT` | `8` | Attempts per window per IP+email |
| `AEGIS_LOGIN_RATE_WINDOW_SECONDS` | `60` | Rate-limit window |
| `AEGIS_WS_REVALIDATION_SECONDS` | `15` | WebSocket session revalidation/heartbeat interval |
| `AEGIS_BOOTSTRAP_ADMIN_EMAIL` | unset | First admin created when demo mode is off |
| `AEGIS_BOOTSTRAP_ADMIN_PASSWORD` | unset | Bootstrap admin password; minimum 12 characters |
| `AEGIS_BOOTSTRAP_ADMIN_NAME` | `Bootstrap Admin` | Bootstrap admin display name |

Production/staging startup fails closed if demo mode is enabled, cookies are not secure, or CORS contains `*`. Demo seeding is refused whenever `AEGIS_DEMO_MODE=false`; use `python -m scripts.bootstrap` to create the first administrator instead.

Frontend variables: `VITE_API_BASE=/api`, `VITE_WS_PATH=/api/ws/events`. Demo credentials are bundled only in development, or when `VITE_DEMO_MODE=true` is explicitly set. Production builds run a secret scan and fail if the demo password is present.

## Testing

```powershell
# Backend
cd backend
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m pip_audit -r requirements.txt
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m alembic check
.\.venv\Scripts\python.exe scripts\check.py

# Frontend unit tests, audit, and production build
cd ..\frontend
npm.cmd test
npm.cmd run typecheck
npm.cmd audit --audit-level=moderate
$env:VITE_DEMO_MODE="false"; npm.cmd run build
npm.cmd run check:build-secrets

# Browser tests (Playwright; installs a browser on first run)
npx.cmd playwright install chromium
npm.cmd run e2e
```

Last verified locally:

- Backend: `79 passed`
- Frontend unit tests: `20 passed`
- TypeScript: no errors
- Production build: Vite 8 build succeeded; secret scan passed
- Playwright Chromium: `3 passed` (login, role containment, all staff surfaces)
- `npm audit`: 0 vulnerabilities; `pip-audit`: no known vulnerabilities
- Alembic: `upgrade head` and `check` succeed on a fresh SQLite database

Docker, PostgreSQL, and the Dockerfiles were hardened but could not be executed in the build environment because Docker is unavailable. Treat the Compose path as unverified until run on a Docker host.

## Docker (hardened, unverified here)

Local demo:

```powershell
Copy-Item .env.example .env
# Edit .env: set POSTGRES_PASSWORD and change AEGIS_DEMO_PASSWORD.
docker compose up --build
```

Open <http://localhost:8080>. The backend container runs Alembic migrations and `scripts.bootstrap`; in demo mode bootstrap seeds the synthetic organization, and with demo mode off it requires `AEGIS_BOOTSTRAP_ADMIN_EMAIL` plus a 12+ character `AEGIS_BOOTSTRAP_ADMIN_PASSWORD`. Demo seeding is impossible while `AEGIS_DEMO_MODE=false`.

Production posture:

```dotenv
AEGIS_ENVIRONMENT=production
AEGIS_DEMO_MODE=false
AEGIS_COOKIE_SECURE=true
AEGIS_ALLOWED_ORIGINS=https://aegis.example.com
AEGIS_BOOTSTRAP_ADMIN_EMAIL=admin@example.com
AEGIS_BOOTSTRAP_ADMIN_PASSWORD=<long-random-password>
POSTGRES_PASSWORD=<long-url-safe-password>
```

Terminate TLS in front of the frontend container; the bundled nginx listens on `8080` over HTTP. Compose binds published ports to loopback by default, uses a read-only backend filesystem, drops Linux capabilities, runs the API as UID 10001, and serves the SPA with CSP, no-store HTML, immutable hashed assets, and gzip.

Model artifacts are no longer trained during container startup. Train explicitly when you need model endpoints:

```powershell
docker compose run --rm backend python -m scripts.train_model --rows 5000 --seed 42
```

PostgreSQL data and model artifacts persist in named volumes. The Docker path remains unverified in this environment; run it on a Docker host before relying on it.

## Architecture documents

- [Architecture](docs/ARCHITECTURE.md)
- [Threat model](docs/THREAT_MODEL.md)
- [ML methodology](docs/ML_METHODOLOGY.md)
- [API reference](docs/API.md)
- [Demo guide](docs/DEMO_GUIDE.md)
- [Security policy](SECURITY.md)

## Security model at a glance

- Passwords are hashed with scrypt. Sessions use opaque tokens stored hashed server-side and delivered in HttpOnly cookies.
- Unsafe methods require a CSRF double-submit token (`aegis_csrf` cookie + `X-CSRF-Token` header).
- Authorization is enforced server-side with role dependencies; hidden UI controls are not a security boundary.
- Production/staging refuses demo mode, insecure cookies, and wildcard CORS at startup. Demo accounts cannot be seeded outside demo mode.
- Live WebSocket clients are revalidated against session revocation, and revoked sessions are closed with code `4401`.
- Readiness (`/api/health/ready`) checks database access and audit-chain integrity; every response carries an `X-Request-ID`.
- The SPA ships CSP and anti-framing headers; production bundles are scanned for the demo password.
- CI runs backend tests, migrations, dependency audits, frontend tests, production build, bundle-secret scan, and Playwright.
- The anomaly model may only escalate controls. Mandatory policy denials always win.
- Audit entries are hash-chained and exposed for verification. Reset does not erase audit history.
- CSV exports neutralize spreadsheet formula injection.

## Honest limitations

- Synthetic identities, devices, locations, and behavior; no production data or calibrated attack probability.
- No SSO/SAML/OIDC, MFA, EDR, MDM, IP reputation, or real device attestation.
- In-process login rate limiting and realtime fan-out; a multi-worker deployment needs shared state.
- SQLite is a local convenience. PostgreSQL is the intended shared database.
- No HA, backup/restore drill, secrets manager, SIEM export, or compliance certification.
- Docker/Compose hardening is included but unverified because Docker is unavailable here.
- Focus trapping and modal semantics are covered for the command palette and mobile navigation, not audited across every component.
- The dependency audit is point-in-time; there is no SBOM, signed artifact, or continuous supply-chain attestation.
