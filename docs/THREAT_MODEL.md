# Threat Model

## Scope and assumptions

This threat model covers the local prototype: browser SPA, FastAPI API, SQLite/PostgreSQL persistence, synthetic demo identities/devices, and the Isolation Forest artifact. It assumes a single trusted operator host for local use. Docker Compose is provided but unverified here.

Out of scope for this prototype: real SSO/MFA, real device attestation, endpoint detection, network segmentation, production secret management, distributed rate limiting, HA, disaster recovery, and formal compliance certification.

## Assets

- Session tokens and CSRF secrets.
- Password hashes and demo credentials.
- Access decisions, policy versions, and evidence.
- Behavioral signals and model artifacts.
- Audit ledger integrity.
- Incident records and investigation notes.
- Device trust states and identity status.

## Actors

- Anonymous internet user.
- Authenticated employee.
- Security analyst.
- Security administrator.
- Auditor (read-only).
- Malicious or compromised insider.
- Operator with local filesystem access.

## Trust boundaries

1. Browser ↔ API over HTTP(S).
2. API ↔ database.
3. API ↔ model artifact filesystem.
4. Staff UI ↔ employee self-service.
5. Demo scenarios ↔ production service paths.
6. Docker network ↔ host.

## Threats and mitigations

| Threat | Impact | Mitigation | Residual risk |
| --- | --- | --- | --- |
| Credential stuffing / brute force | Account takeover | scrypt hashes, dummy-hash verification, login rate limit, disabled-account denial, audit of failures | In-process limiter only; no MFA or distributed lockout |
| Session theft | Impersonation | Opaque random tokens, hashed server storage, HttpOnly/SameSite cookies, short TTL, revocation on `RESTRICT`, WebSocket revalidation | No token binding; XSS or host compromise remains serious |
| CSRF | Forced state change | Double-submit cookie + `X-CSRF-Token`; enforced when either cookie is present; active sessions bind the token to the session secret; SameSite=Lax; login exempt only | Subdomain/related-origin attacks need deployment review |
| IDOR / horizontal privilege escalation | Employee reads another identity | Self-scoped identity detail and access list; server-side role checks | A logic bug could still expose data; tests cover key paths |
| Vertical privilege escalation | Employee performs admin action | Role dependencies on every mutation; UI controls hidden but not trusted | Compromised staff account has broad power |
| Policy bypass via low risk | Unauthorized access | Deterministic mandatory denies run before risk thresholds; model cannot grant access | Misconfigured policy can still open legitimate access |
| Model poisoning / artifact tampering | Skewed risk scoring | Artifacts gitignored; missing artifacts fail closed outside development; retraining admin-only and audited; local filesystem trusted | No artifact signing or supply-chain verification |
| Audit tampering | Loss of accountability | Append-only application paths, SHA-256 chain, verify endpoint, reset preserves ledger | DB administrator can rewrite and recompute the chain; external anchoring absent |
| Realtime spoofing | False UI alerts | WebSocket is read-only and authenticated server-side; UI invalidates data rather than trusting payload as authority | Browser/network compromise remains |
| XSS | Session/CSRF theft and UI manipulation | React escaping, no raw HTML injection, CSP on the production SPA, anti-framing headers | Vite dev server does not enforce the nginx CSP; dependency review is point-in-time |
| CSV formula injection | Spreadsheet code execution | Exports neutralize leading formula characters | User spreadsheet configuration varies |
| Sensitive data in logs | Credential/evidence leakage | Login audit stores email/reason only; no passwords or raw tokens; request logs carry method/path/status/request ID without bodies; error envelope hides internals | URLs can still contain resource/access IDs |
| Demo data mistaken for real | Misleading decisions/claims | `is_simulated` tags, model limitations, explicit demo mode, demo seeding refused outside demo mode, production startup rejects demo mode | Operator could misrepresent a demo |
| Supply-chain compromise | Malicious dependency or build artifact | Pinned lockfile, npm audit, pip-audit, CI gates, production bundle demo-password scan, non-root containers | No SBOM signing or reproducible-build attestation |
| Device spoofing | False trust signal | Device state is authoritative in the DB and only admins change it | No real attestation; enrollment is a trust ceremony, not proof |
| Race conditions / duplicate writes | Inconsistent decisions | Single transaction per decision; unique IDs and DB constraints | No distributed concurrency testing |
| Denial of service | Console unavailable | Input validation, pagination caps, rate-limited login | No WAF, queue limits, or horizontal scaling |

## Key abuse cases

### Employee probes staff APIs

An employee calls `/api/audit`, `/api/identities`, or `/api/policies` directly. Role dependencies return `403`. The SPA boundary is convenience only.

### Employee guesses another identity ID

Identity detail uses the authenticated context. Employees receive `403` unless the ID matches their own identity.

### Attacker replays a state-changing request

Without the matching CSRF cookie/header pair, unsafe requests fail. A stolen session and CSRF token together defeat this control, which is why XSS and host compromise are treated as critical.

### Low-risk malicious request

The anomaly model may score a novel attack as low risk. Policy role, device, action, and account checks still deny unauthorized access. Risk can only escalate friction.

### Audit rewrite

A local DB administrator can alter rows and recompute hashes. The chain detects accidental or partial tampering, but it is not externally anchored. Production needs write-once storage or external attestation.

## Security invariants to preserve

- The model never returns an authorization grant and never overrides a mandatory denial.
- Sessions are resolved server-side; cookie contents are not trusted claims.
- Every mutation emits an audit record and, where relevant, a security event.
- Employees can read only their own identity/access data.
- Policy publishing creates a new immutable version.
- Demo reset never deletes audit history.

## Production hardening backlog

- OIDC/SAML SSO and phishing-resistant MFA.
- External secret manager and signed model artifacts.
- Redis-backed sessions/rate limits and multi-worker WebSocket fan-out.
- Real EDR/MDM attestation and IP/geo reputation with privacy review.
- SBOM generation, artifact signing, reproducible builds, and continuous vulnerability monitoring.
- External audit anchoring and retention policy.
- PostgreSQL backup/restore drills, HA deployment, and load/failover testing.
- Log redaction review, retention policy, and SIEM export.
- Independent accessibility and penetration testing.
