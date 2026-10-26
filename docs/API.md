# API Reference

Base URL: `http://127.0.0.1:8000/api`

Interactive OpenAPI docs: <http://127.0.0.1:8000/api/docs>  
OpenAPI JSON: <http://127.0.0.1:8000/api/openapi.json>

The Vite dev server proxies `/api` to port 8000, so the SPA uses same-origin relative paths.

## Authentication and CSRF

1. `POST /api/auth/login` with `{ "email": "...", "password": "..." }`.
2. The response sets:
   - `aegis_session` — HttpOnly session cookie;
   - `aegis_csrf` — readable CSRF cookie.
3. Unsafe requests (`POST`, `PATCH`, `PUT`, `DELETE`) must send the CSRF value in `X-CSRF-Token`.
4. `GET /api/auth/me` returns the current principal plus a fresh `csrf_token`.
5. `POST /api/auth/logout` revokes the session and clears cookies.

Login is CSRF-exempt because no session exists yet. All other unsafe endpoints require the double-submit token whenever either auth cookie is present, so a stale/revoked session cannot skip CSRF. With an active session, the header must match both the readable cookie and the session's CSRF secret. Cookies are `SameSite=Lax`; `AEGIS_COOKIE_SECURE=true` is required outside development.

### curl example

```bash
curl -i -c cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@aegisnexus.ai","password":"ChangeMe-Demo!2026"}' \
  http://127.0.0.1:8000/api/auth/login

CSRF=$(awk '$6 == "aegis_csrf" { print $7 }' cookies.txt)

curl -b cookies.txt \
  -H "X-CSRF-Token: $CSRF" \
  http://127.0.0.1:8000/api/overview
```

For mutations, reuse both `-b cookies.txt` and the `X-CSRF-Token` header.

## Errors

All application errors use one envelope:

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to perform this action.",
    "details": null
  }
}
```

Common statuses:

| Status | Meaning |
| --- | --- |
| `400` | Domain rule cannot be satisfied |
| `401` | Missing, expired, or invalid session |
| `403` | Authenticated but not authorized / self-scope violated |
| `404` | Resource not found |
| `409` | Conflict (for example, no active policy on publish) |
| `422` | Schema or query validation failure |
| `429` | Login rate limit exceeded |

Validation errors use code `VALIDATION_ERROR` and a `details` array with `location`, `message`, and `type`. Unhandled errors return a generic `INTERNAL_ERROR` without internals.

## Roles

| Role | Access |
| --- | --- |
| `SECURITY_ADMIN` | Full staff capabilities, policy publish, enrollment, retraining, demo reset |
| `SECURITY_ANALYST` | Evaluate, investigate, notes, preview policy, demo runs, staff read |
| `AUDITOR` | Staff read, audit verification/export; no mutations or evaluation |
| `EMPLOYEE` | Own identity/access history and personal posture only |

## Pagination

List endpoints returning pages use:

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "page_size": 20
}
```

`page` defaults to 1 and may not exceed 10,000. `page_size` defaults to 20 and is capped at 100. Lists without pagination return arrays.

## Health and meta

| Method | Path | Role | Notes |
| --- | --- | --- | --- |
| GET | `/health` | Public | Minimal liveness status |
| GET | `/health/ready` | Public | `200` ready or `503`; checks database and audit-chain integrity |
| GET | `/health/detailed` | Any authenticated | Database, model, runtime, and demo-mode detail |
| GET | `/api` | Public | Name, tagline, version, server time |

Every response includes `X-Request-ID`. A valid caller-supplied value (1-64 characters of letters, digits, `.`, `_`, or `-`) is preserved; otherwise a new ID is generated.

## Authentication

| Method | Path | Role | Notes |
| --- | --- | --- | --- |
| POST | `/auth/login` | Public | Sets session + CSRF cookies; rate-limited |
| GET | `/auth/me` | Any authenticated | Principal, risk, role, session expiry, CSRF token |
| POST | `/auth/logout` | Any authenticated | Revokes current session |

## Identities

| Method | Path | Role | Notes |
| --- | --- | --- | --- |
| GET | `/identities` | Staff | Filters: `q`, `role`, `status`, `page`, `page_size` |
| GET | `/identities/{identity_id}` | Self or staff | Employees receive `403` for another identity |

Identity detail includes posture, devices, behavioral summary, recent events, risk history, and related evidence.

## Devices

| Method | Path | Role | Notes |
| --- | --- | --- | --- |
| GET | `/devices` | Staff | Filters: `q`, `state`, `identity_id`, pagination |
| POST | `/devices` | Admin | Enroll: `identity_id`, `name`, `device_type`, `operating_system`, `initial_state` |
| PATCH | `/devices/{device_id}/state` | Admin | `{ "state": "TRUSTED|UNVERIFIED|RESTRICTED|REVOKED", "reason": "..." }` |

State changes require a reason of at least 3 characters and are audited.

## Access decisions

| Method | Path | Role | Notes |
| --- | --- | --- | --- |
| GET | `/access-requests` | Self or staff | Employees only see their own; staff may filter by identity |
| GET | `/access-requests/{request_id}` | Self or staff | Employees only see their own evidence |
| GET | `/access-requests/export.csv` | Staff | Same filters as list; audited export |
| POST | `/access-requests/evaluate` | Admin, analyst, employee self | Auditors are read-only |

List filters: `q`, `decision`, `risk_category`, `identity_id`, `from_time`, `to_time`, pagination. Times are ISO 8601 and normalized to UTC.

### Evaluate request

```json
{
  "identity_id": null,
  "resource_id": "res_finance_reports",
  "device_id": "dev_maya_laptop",
  "requested_action": "READ",
  "features": {
    "login_hour": 10,
    "day_of_week": 2,
    "failed_logins_15m": 0,
    "requests_1h": 12,
    "distinct_resources_1h": 3,
    "sensitive_access_ratio": 0.2,
    "new_device": false,
    "geo_novelty": false,
    "session_duration_min": 45,
    "activity_deviation": 0.3
  },
  "simulate": false
}
```

- Staff may set `identity_id` to another identity. Employees are forced to their own identity.
- `requested_action` is one of `READ`, `WRITE`, `DELETE`, `ADMIN`.
- `simulate: true` evaluates and returns evidence without persisting a request. Demo/UI calls normally use `false`.

### Decision response

```json
{
  "request_id": "ar_...",
  "identity_id": "idn_...",
  "resource_id": "res_...",
  "requested_action": "READ",
  "decision": "CHALLENGE",
  "risk_category": "HIGH",
  "risk_score": 71.4,
  "anomaly_score": -0.123456,
  "policy_version": "pol_...",
  "reasons": [
    { "code": "RISK_ABOVE_CHALLENGE_THRESHOLD", "message": "..." }
  ],
  "recommended_next_step": "...",
  "timestamp": "2026-10-26T17:51:12Z",
  "correlation_id": "...",
  "is_simulated": false
}
```

Possible `decision` values: `ALLOW`, `CHALLENGE`, `RESTRICT`, `DENY`. Mandatory policy denials take precedence over risk thresholds. See [Architecture](ARCHITECTURE.md) for the full ordered flow.

## Resources and policies

| Method | Path | Role | Notes |
| --- | --- | --- | --- |
| GET | `/resources` | Staff | Filters: `q`, `sensitivity`; includes active policy |
| GET | `/resources/{resource_id}` | Staff | Resource plus active policy |
| GET | `/resources/{resource_id}/policies` | Staff | Version history, newest first |
| PUT | `/resources/{resource_id}/policy` | Admin | Publish a new active policy version |
| POST | `/policies/preview` | Admin, analyst | Simulate a draft; never persists |

Publish body:

```json
{
  "allowed_roles": ["SECURITY_ADMIN", "SECURITY_ANALYST"],
  "allowed_device_states": ["TRUSTED"],
  "challenge_threshold": 55,
  "deny_threshold": 80,
  "require_additional_verification": true,
  "session_max_minutes": 60,
  "reason": "Tighten access to privileged console",
  "is_active": true
}
```

`challenge_threshold` must be less than `deny_threshold`. At least one role and device state are required. Publishing retires the previous policy in the same transaction and audits both the publish and retirement.

Preview body:

```json
{
  "draft": {
    "allowed_roles": ["EMPLOYEE"],
    "allowed_device_states": ["TRUSTED"],
    "challenge_threshold": 55,
    "deny_threshold": 80,
    "require_additional_verification": true,
    "session_max_minutes": 60,
    "reason": "Preview employee access",
    "is_active": true
  },
  "cases": [
    {
      "role": "EMPLOYEE",
      "device_state": "TRUSTED",
      "risk_score": 20,
      "account_active": true,
      "identity_authorized": true,
      "session_active": true,
      "repeated_anomalies": 0
    }
  ]
}
```

## Events and notifications

| Method | Path | Role | Notes |
| --- | --- | --- | --- |
| GET | `/events` | Staff | Filters: `q`, `event_type`, `category`, `severity`, `identity_id`, time range, pagination |
| GET | `/events/{event_id}` | Staff | Event evidence, including access/device links |
| GET | `/notifications` | Staff | Recent high/critical event notifications |

Realtime: `ws://127.0.0.1:8000/api/ws/events` (HTTPS: `wss://`). Staff sessions are revalidated at connect, on each inbound frame, and every `AEGIS_WS_REVALIDATION_SECONDS`; a revoked, expired, inactive, or non-staff session is closed with code `4401`. The server sends heartbeat frames and:

```json
{
  "type": "security_event",
  "event": {
    "id": "evt_...",
    "event_type": "ACCESS_DENIED",
    "severity": "HIGH",
    "timestamp": "..."
  }
}
```

Clients must still fetch authoritative data; the socket is a change signal, not a replacement for API authorization.

## Incidents

| Method | Path | Role | Notes |
| --- | --- | --- | --- |
| GET | `/incidents` | Staff | Filters: `q`, `status`, `severity`, `identity_id`, `assigned_to`, pagination |
| GET | `/incidents/{incident_id}` | Staff | Detail, notes, related access requests/events |
| PATCH | `/incidents/{incident_id}` | Admin, analyst | Update status, severity, assignee, resolution, optional note |
| POST | `/incidents/{incident_id}/notes` | Admin, analyst | Add investigation note |

There is no separate “contain” endpoint. Containment is:

```json
PATCH /api/incidents/{incident_id}
{ "status": "CONTAINED", "note": "Contained the affected session" }
```

Rules:

- at least one mutable field is required;
- assignee must be an active admin/analyst;
- `RESOLVED` and `FALSE_POSITIVE` require `resolution` text;
- notes are 1–2000 characters.

## Overview

| Method | Path | Role | Notes |
| --- | --- | --- | --- |
| GET | `/overview?range_hours=24` | Staff | `1`, `6`, `24`, `72`, or `168`; invalid → `422 INVALID_RANGE` |

Includes posture cards, decision mix, risk distribution, trend series, recent incidents/events, and model anomaly rate. `model_anomaly_rate` is already a percentage (0–100).

## Model

| Method | Path | Role | Notes |
| --- | --- | --- | --- |
| GET | `/model/evaluation` | Staff | Metrics, confusion matrix, split sizes, limitations |
| GET | `/model/features` | Staff | Feature metadata |
| POST | `/model/retrain?seed=42&rows=5000` | Admin | Synchronous retrain; writes artifacts; audited |

`rows` is bounded by API validation. Model artifacts are stored under `AEGIS_MODEL_ARTIFACT_DIR`.

## Audit

| Method | Path | Role | Notes |
| --- | --- | --- | --- |
| GET | `/audit` | Staff | Filters: `q`, `action`, `actor_id`, `target_type`, time range, pagination |
| GET | `/audit/verify` | Staff | Recomputes the SHA-256 chain and reports integrity |
| GET | `/audit/export.csv` | Staff | Same filters; export is itself audited |

Audit rows include sequence, actor, action, target, result, correlation ID, policy version, metadata JSON, and hash-chain fields.

## Settings

| Method | Path | Role | Notes |
| --- | --- | --- | --- |
| GET | `/settings/info` | Staff | Non-secret runtime configuration and prototype posture |

## Demo

Demo endpoints require `AEGIS_DEMO_MODE=true`.

| Method | Path | Role | Notes |
| --- | --- | --- | --- |
| GET | `/demo/scenarios` | Staff | Scenario catalog and expectations |
| POST | `/demo/scenarios/{A-F}` | Admin, analyst | Run one scenario |
| POST | `/demo/run` | Admin, analyst | Run all scenarios sequentially |
| POST | `/demo/reset` | Admin | Recreate synthetic demo data; preserves audit and appends `DEMO_RESET` |

Scenario IDs are uppercase `A`–`F`: allow, challenge, role denial, disabled account, repeated-anomaly restriction, exfiltration denial. Each run uses the real access/policy/incident/audit path.

## Downloads and caching

CSV responses use `text/csv` with attachment filenames. Formula-leading cells are neutralized. All responses set `Cache-Control: no-store` plus security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`).

## Prototype boundaries

No rate limiting beyond login, no distributed session store, no SSO/MFA, no real device attestation, and no external audit anchoring. See [Threat Model](THREAT_MODEL.md).
