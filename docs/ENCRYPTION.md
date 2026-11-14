# Encryption and Data Protection

This document states exactly what AEGIS NEXUS AI encrypts, how, and what it does **not** claim. It is written to be verifiable from the running system.

## What we claim (and what we do not)

- We do **not** claim end-to-end encryption. In a web console the server reads data to make decisions and render evidence, so end-to-end encryption (where only the endpoints hold keys) would be inaccurate.
- We **do** claim: encryption in transit, encryption at rest for sensitive fields, and one-way hashing for secrets.

## Encryption in transit

- The app is served over HTTPS; TLS is terminated at the edge (Fly.io).
- Session and CSRF cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` outside development.
- The WebSocket uses the same origin and is authenticated server-side.

## Encryption at rest

- Sensitive free-text fields are encrypted with **AES-256-GCM** (authenticated encryption) before they reach the database.
- A SQLAlchemy type decorator encrypts on write and decrypts on read, so services and the API work with plaintext while the database stores only ciphertext.
- Ciphertext format: `enc:v1:<base64(nonce || ciphertext || GCM tag)>`. The `v1` tag allows future key/format rotation; rows written before encryption (no prefix) stay readable.
- Because GCM is authenticated, an edited or corrupted ciphertext fails to decrypt instead of returning attacker-controlled plaintext.

Encrypted columns:

| Table | Column |
| --- | --- |
| `leak_findings` | `leaked_value_masked`, `source_name`, `remediation` |
| `incident_notes` | `note` |
| `incidents` | `resolution` |

Intentionally **not** encrypted (and why):

- `identities.email` and other lookup columns, because they are used in search and filtering.
- The append-only audit ledger, because it is an integrity layer verified by a SHA-256 hash chain.

## Key management

- The key is supplied by `AEGIS_ENCRYPTION_KEY` (base64 of 32 random bytes).
- Outside development the key is required and startup fails closed without it.
- Development and tests use a documented, non-secret default key so local runs work.
- The deployed demo runs in development/demo mode, but a real key can be supplied without disabling demo mode: the deploy workflow stages `AEGIS_ENCRYPTION_KEY` as a Fly secret when the `AEGIS_ENCRYPTION_KEY` repository secret is set, and `GET /api/security/encryption` then reports `key_source = AEGIS_ENCRYPTION_KEY`.
- Demo data is seeded at container start (not image build time), so it is encrypted with the same key that decrypts it at runtime.

## One-way hashing for secrets

- Passwords: scrypt (`N=2^14, r=8, p=1`, 64 MB), per-password salt.
- Session tokens: random tokens stored as SHA-256 hashes server-side.
- Audit ledger: SHA-256 hash chain over canonical row fields.

## Authentication verification (live proof)

`GET /api/security/authentication` returns evidence read from the live database, not a static claim:

| Control | What is verified |
| --- | --- |
| Password hashing | Algorithm and scrypt parameters, plus a count of identities whose stored hash is **not** a scrypt hash (should be `0`) and a truncated sample of the current user's stored hash |
| Session tokens | The stored SHA-256 digest of the current session, plus a count of sessions whose stored value is not a 64-char hash, i.e. raw tokens on disk (should be `0`) |
| CSRF | Enabled, double-submit cookie + `X-CSRF-Token`, bound to the session |
| Cookies | Session cookie `HttpOnly`, `Secure` (outside development), `SameSite=Lax`; CSRF cookie readable by design |
| Login rate limit | Configured limit and window |
| Authorization | Server-side role dependencies, the staff-only route list, and a live probe computed at request time: no session → `401`, employee role → `403`, staff role → `200` |
| Audit chain | Live `verify_audit_chain` result and record count |

The Compliance page renders this as the "Authentication verification" panel.

## Verify it yourself

- `GET /api/security/encryption` reports the posture and reads one stored value **directly from the database** (bypassing the ORM) so you can see ciphertext on disk beside the decrypted value. It also reports `plaintext_leaks`: the number of values in encrypted columns that are not ciphertext (should be `0`).
- `GET /api/security/authentication` reports the authentication evidence above.
- The Compliance page renders both as live panels.

## Honest limitations

- A single application key with no external KMS, per-tenant keys, or automated rotation; an operator holding both the database and the key can decrypt fields.
- Lookup columns and the audit ledger are readable by design.
- Transport security depends on the platform TLS termination.
