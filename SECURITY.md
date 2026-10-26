# Security Policy

AEGIS NEXUS AI is a hardened prototype, not a certified production security product. It demonstrates zero-trust policy enforcement, behavioral anomaly ranking, and tamper-evident auditing with synthetic data. The controls below are intended to make local review and controlled demos safer; they do not replace an independent security assessment.

## Supported versions

There are no long-term-support releases. Security fixes are applied to the current `main` line on a best-effort basis. Older snapshots, forks, and modified deployments are unsupported.

## Reporting a vulnerability

Do not open a public issue containing exploit details, credentials, or sensitive data. Report privately to the maintainer through the private channel used to distribute this project, or through a GitHub security advisory if the project is hosted on GitHub. Include:

- affected commit/version and deployment mode;
- reproduction steps or a minimal proof of concept;
- impact and any known preconditions;
- whether demo accounts or synthetic data are involved.

There is no bug bounty or guaranteed response SLA. Please allow time for triage and a coordinated fix before disclosure.

## Security model

- Passwords are hashed with scrypt. Sessions use opaque random tokens stored hashed server-side, with HttpOnly/SameSite cookies and configurable TTL.
- Unsafe requests require a CSRF double-submit token. The check applies whenever either auth cookie is present, and active sessions bind the token to the session secret.
- Authorization is enforced server-side by role. Employees can read only their own identity and access records.
- Policy denials are final; the anomaly model may only escalate. The risk index is an anomaly ranking, not an attack probability.
- Audit entries form a SHA-256 hash chain. Readiness checks verify the chain, and demo reset does not erase audit history.
- Outside development, startup rejects demo mode, insecure cookies, and wildcard CORS. Demo accounts cannot be seeded when demo mode is disabled.
- WebSocket clients are revalidated against session revocation and closed with code `4401` when invalid.
- The production SPA is served with CSP and anti-framing headers, and production bundles are scanned for the demo password.
- CI runs backend tests, migrations, `pip-audit`, frontend tests, `npm audit`, a production build, bundle-secret scanning, and Playwright.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md) for design detail and residual risk.

## Deployment checklist

Before exposing an instance beyond a trusted local machine:

1. Set `AEGIS_ENVIRONMENT=production` and `AEGIS_DEMO_MODE=false`.
2. Set `AEGIS_COOKIE_SECURE=true` and terminate TLS in front of the app.
3. Replace `AEGIS_ALLOWED_ORIGINS` with exact HTTPS origins; never use `*`.
4. Set a strong, unique `AEGIS_BOOTSTRAP_ADMIN_PASSWORD` (12+ characters) and `AEGIS_BOOTSTRAP_ADMIN_EMAIL`; bootstrap once, then remove the password from the environment.
5. Replace all database and demo secrets. Never place secrets in `VITE_*` variables; Vite values are public.
6. Use PostgreSQL with a strong `POSTGRES_PASSWORD`, restrict network access, and test backup/restore.
7. Train and review a model artifact explicitly. Container startup does not train one.
8. Require HTTPS for the UI and WebSocket, and keep published ports behind a reverse proxy or private network.
9. Monitor `/api/health/ready`, structured logs, and audit-chain verification.
10. Run the backend/frontend verification commands in the [README](README.md), plus dependency audits, before deployment.

The bundled Docker Compose topology has not been executed in this environment. Validate it on a Docker host, including PostgreSQL, cookies over TLS, migrations, bootstrap, and readiness, before relying on it.

## Known limitations

- No SSO, MFA, SIEM export, external audit anchoring, secrets manager, artifact signing, SBOM, HA, or multi-tenancy.
- Login rate limiting and WebSocket fan-out are in-process; multi-worker deployments need shared state.
- A database administrator can rewrite the audit chain and its verification baseline.
- Demo data is synthetic and model metrics describe synthetic separation only.
- Accessibility work covers the command palette and mobile navigation, not a full WCAG audit.
- Docker/PostgreSQL hardening is configuration-reviewed but unverified locally.

## Safe demo operation

Demo credentials are public by design. Use demo mode only with synthetic data on a trusted network. Do not reuse demo passwords, expose a demo instance to the public internet, or represent synthetic findings as real attacks.
