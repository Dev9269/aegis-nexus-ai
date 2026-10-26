# Demo Guide

## Before the demo

1. Start the API and SPA using the quick start in the [README](../README.md), or use the Docker demo path.
2. Confirm `http://127.0.0.1:5173` (or `http://localhost:8080` under Compose) loads and the sign-in page is styled.
3. Confirm `AEGIS_DEMO_MODE=true` and sign in as `admin@aegisnexus.ai` with `AEGIS_DEMO_PASSWORD` (default `ChangeMe-Demo!2026`).
4. Open **Demo scenarios**. If records look stale, use **Reset demo data** once, then wait for the overview to refresh.
5. Keep a second browser profile or private window ready for the employee view.

Demo accounts exist only in demo mode. With `AEGIS_DEMO_MODE=false`, seeding is refused and the first administrator comes from `scripts.bootstrap` plus `AEGIS_BOOTSTRAP_ADMIN_EMAIL`/`AEGIS_BOOTSTRAP_ADMIN_PASSWORD`.

The demo is strongest when you alternate between the executive story and the evidence behind a decision.

## Five-minute narrative

### 1. Command center — “What is happening now?”

Start on the overview as admin.

Point out:

- posture cards for identities, open incidents, decisions, and model health;
- decision mix and risk distribution;
- live activity and recent incidents;
- the model anomaly rate, explicitly described as a ranking signal;
- the range selector.

Talk track: *“This is one console for identity posture, access evidence, and behavioral deviation. The model prioritizes attention; policy still decides access.”*

### 2. Identity dossier — “Who is this, and what is normal?”

Open an identity, preferably Maya Chen.

Point out:

- role, department, status, current risk;
- trusted/unverified devices;
- behavioral factors and risk history;
- recent access decisions and security events;
- the distinction between anomaly evidence and policy reasons.

Talk track: *“We do not just show a score. We show what deviated from this person’s baseline, and which policy rule applied.”*

### 3. Access evidence — “Why was this allowed or blocked?”

Open **Access decisions** and select a recent request.

Point out:

- subject, resource, action, device, and timestamp;
- decision badge and risk category;
- ordered policy reasons;
- feature deviations with values and baselines;
- policy version and correlation ID.

Talk track: *“Every decision is reproducible evidence. We retain the policy version that was active at evaluation time.”*

### 4. Role boundary — “Low risk does not mean authorized.”

Run **Scenario C**. Sofia Alvarez is low risk but requests the security console.

Expected: `DENY`, reason `ROLE_NOT_AUTHORIZED`.

Talk track: *“The model is not the authority. A perfectly normal employee still cannot enter a resource their role does not permit.”*

### 5. Step-up — “Normal device trust is not enough when behavior changes.”

Run **Scenario B**. Maya uses an unverified VM with unusual context.

Expected: `CHALLENGE`, reason `RISK_POLICY_CHALLENGE`.

Talk track: *“We add friction instead of binary allow/deny. The policy threshold determines the response.”*

### 6. Repeated anomalies — “Escalate and contain.”

Run **Scenario E**. Leo Martins makes three high-risk write attempts.

Expected progression: two `CHALLENGE` decisions, then `RESTRICT` with `REPEATED_ANOMALIES`. Active sessions are revoked and an incident is opened.

Then open **Incidents**, select the new incident, assign it to yourself, and add a note. Optionally set it to `CONTAINED`.

Talk track: *“Repeated behavior changes the response. Restrict revokes active sessions, and the incident keeps the investigation together.”*

### 7. Exfiltration-style denial — “High confidence, still explainable.”

Run **Scenario F**. Amara Okafor produces bulk sensitive-resource behavior.

Expected: `DENY`, reason `RISK_POLICY_DENY`, incident opened.

Open the decision and show the top feature deviations. Emphasize that these are descriptive, not a claim of intent.

### 8. Audit — “Can we prove the record was not edited?”

Open **Audit** and run **Verify chain**. Show a recent `POLICY_PUBLISHED`, `ACCESS_EVALUATED`, `SESSION_REVOKED`, or `EXPORT_AUDIT_LOG` entry.

Talk track: *“Operational evidence is hash-chained. Reset does not erase the ledger; it adds another entry.”*

### 9. Policy studio — “Change control, not a settings toggle.”

Open **Policies**, select a resource, and preview a draft. Explain that preview is non-persistent. As admin, publish a change with a reason, then show that a new immutable version exists and the old version is retired.

Talk track: *“Policy changes are versioned and audited. Access evidence keeps the version used at decision time.”*

### 10. Employee view — “Give people their own posture.”

Sign in as `maya.chen@aegisnexus.ai`.

Point out:

- personal greeting, risk gauge, and guidance;
- recent decisions and device posture;
- behavioral factors and alerts;
- no staff navigation and no other identities;
- deep-link attempts to staff routes produce an access-boundary state.

Talk track: *“Zero trust is not only a control plane. Employees get transparency about their own posture without seeing the security operation.”*

## Scenario reference

| ID | Subject | Resource / action | Expected | What to emphasize |
| --- | --- | --- | --- | --- |
| A | Maya Chen | Finance Reports / READ | `ALLOW` | All mandatory and risk policies satisfied |
| B | Maya Chen | Finance Reports / READ from unverified VM | `CHALLENGE` | Risk threshold adds step-up |
| C | Sofia Alvarez | Security Console / READ | `DENY` | Role denial wins despite low risk |
| D | Noah Williams | Engineering Repository / READ | `DENY` | Disabled account is a mandatory denial |
| E | Leo Martins | Engineering Repository / WRITE ×3 | `CHALLENGE` ×2, then `RESTRICT` | Repeated anomalies revoke sessions; incident opens |
| F | Amara Okafor | Finance Reports / READ | `DENY` | Exfiltration-like deviation; incident opens |

Scenarios A–F use the real service path and write audit/event records. Only **Reset demo data** deletes synthetic operational rows; it preserves audit history and appends `DEMO_RESET`.

## Useful questions to invite

- “What would make this a production control?” → SSO/MFA, real device attestation, calibrated data, distributed state, audit anchoring.
- “Is the score a probability?” → No. It is an anomaly ranking; policy is deterministic.
- “Can the model grant access?” → No. It can only add friction or containment.
- “What happens if policy is missing?” → Deny by default.
- “What happens on reset?” → Synthetic operational data is recreated; the audit ledger is preserved.

## Recovery

| Symptom | Fix |
| --- | --- |
| Login fails on a fresh DB | With demo mode on, run `python -m scripts.seed_demo`; with it off, run `python -m scripts.bootstrap` with bootstrap credentials set |
| Demo scenarios say data not ready | Seed or reset demo data |
| Model missing | Run `python -m scripts.train_model`; development can bootstrap a baseline on first use, but production fails closed |
| WebSocket closes with 4401 | Sign in again; the session was revoked, expired, inactive, or lacked a staff role |
| E2E cannot reach app | Start backend/frontend, or let Playwright start them; check ports 8000/5173 |
| Session keeps expiring | Increase `AEGIS_SESSION_TTL_MINUTES` for the demo |
| Docker Compose fails | Docker remains unverified here; set `POSTGRES_PASSWORD` in `.env` and use the local quick start as fallback |

## Avoid overclaiming

Say “synthetic prototype,” “anomaly ranking,” and “policy-driven decision.” Do not say “predicts attacks,” “calibrated risk,” “production-ready,” or “real device verification.” The honest framing is part of the demo’s credibility.
