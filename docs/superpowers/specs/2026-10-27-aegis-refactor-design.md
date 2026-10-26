# AEGIS NEXUS AI — Modular Refactor Design

**Date:** 2026-10-27  
**Status:** Approved in chat; pending written-spec review  
**Approach:** Incremental strangler refactor inside a modular monolith

## 1. Summary

Reorganize AEGIS NEXUS AI into feature-first frontend modules and layered backend domains without changing external behavior. The refactor separates business rules from HTTP and UI code, centralizes environment configuration, introduces focused client-state stores, standardizes error handling, removes proven duplication/dead code, generates the frontend API contract from OpenAPI, and documents the resulting architecture.

The refactor is staged by domain. Existing API paths, schemas, role rules, cookie names, policy ordering, ML escalation semantics, SPA routes, and demo flows remain unchanged.

## 2. Goals

- Establish feature-first folders for frontend domains and layered domain modules for backend features.
- Move SQL out of routers and HTTP concerns out of services.
- Move page-level business logic into feature models, query hooks, and services.
- Centralize environment parsing and validation; keep secrets out of frontend config.
- Use TanStack Query for server state and small Zustand stores for cross-route client state.
- Standardize backend and frontend error handling, loading, empty, and failure states.
- Remove duplicated helpers, role lists, pagination logic, CSV sanitization, focus handling, and hand-maintained API wire types.
- Make unused-code removal evidence-driven.
- Document structure, conventions, configuration, contracts, and module ownership.
- Preserve all current behavior and pass the full existing verification suite after each migration slice.

## 3. Non-goals

- Product or visual redesign.
- New endpoints, API versioning, or changed request/response contracts.
- Authentication, authorization, policy-engine, audit-chain, database-schema, or ML semantic changes.
- New runtime services or distributed state.
- Docker/PostgreSQL runtime verification when Docker is unavailable.
- Full WCAG, penetration, or performance audits.
- Rewriting tests solely to match new file locations.

## 4. Constraints and invariants

- Preserve `/api/*` paths and the error envelope `{"error": {"code", "message", "details"}}`.
- Preserve `aegis_session` as HttpOnly, `aegis_csrf` as readable, and `X-CSRF-Token` double-submit behavior.
- Preserve roles: `SECURITY_ADMIN`, `SECURITY_ANALYST`, `EMPLOYEE`, `AUDITOR`.
- Preserve mandatory policy denial precedence and ML escalation-only behavior.
- Preserve audit append-only SHA-256 chain semantics and demo-reset behavior.
- Preserve all SPA routes and demo flows.
- Preserve existing `AEGIS_*` environment variable names and defaults.
- Do not place secrets in any `VITE_*` variable.
- Keep `SQLAlchemy==2.0.36` on this Windows environment.
- No new global state for data already owned by TanStack Query.
- No unproven deletion. Code is removed only when imports, build, tests, and generated-contract checks demonstrate it is unused.
- No API versioning in this refactor; add it only when a future breaking change requires it.

## 5. Target structure

### 5.1 Backend

```text
backend/app/
  main.py                    # app factory, lifespan, middleware, exception handlers
  api/
    router.py                # aggregates domain routers under /api
    deps.py                  # auth/database dependencies
    schemas.py               # Page, ErrorResponse, shared transport shapes
  core/
    config/                  # grouped settings, same env names, one validated facade
    database.py              # engine, session factory, get_db, health checks
    errors.py                # ApiError and error-code constants
    logging.py               # structured logging and request IDs
    pagination.py            # shared page parsing/response helper
    roles.py                 # one source of truth for role sets
    time.py                  # ISO-8601 parsing and UTC normalization
    csv.py                   # formula-injection-safe CSV helpers
  db/
    models.py                # centralized SQLAlchemy models
  domains/
    auth/
    identities/
    devices/
    access/
    policies/
    incidents/
    events/
    overview/
    model/
    audit/
    demo/
    system/
      router.py              # HTTP validation and response models only
      schemas.py             # request/response Pydantic models
      service.py             # business rules, transactions, audit/event effects
      repository.py          # SQLAlchemy queries, eager loading, filters, counts
      presenters.py          # model-to-response mappings where needed
  security/                  # passwords, sessions, tokens, CSRF
  ml/                        # feature extraction, scoring, runtime
  realtime/                  # event broadcaster
  seed/                      # synthetic demo data
```

`db/models.py` remains centralized to avoid relationship/import cycles and migration churn.

### 5.2 Frontend

```text
frontend/src/
  app/
    App.tsx
    router.tsx
    providers.tsx
    query-client.ts
    error-boundary.tsx
  config/
    env.ts                   # only module allowed to read import.meta.env
  components/
    ui/                      # split primitives: buttons, badges, forms, overlays, feedback, data
    layout/                  # shell, sidebar, topbar, command palette
    charts/
  features/
    auth/
    access/
    identities/
    devices/
    incidents/
    events/
    policies/
    audit/
    model/
    overview/
    demo/
    settings/
    employee/
      api.ts                 # typed domain calls
      queries.ts             # query keys, queries, mutations
      store.ts               # only for cross-route client state
      model.ts               # filters, defaults, selectors, view models
      components/            # domain-specific components
      pages/                 # route containers
  lib/
    http.ts                  # shared fetch, CSRF, errors, downloads
    format.ts                # dates, numbers, labels
    navigation.ts
  types/                     # shared enums, generated wire types, narrowing helpers
```

### 5.3 Dependency rules

- Backend: router → service → repository.
- Routers contain no SQL, transaction orchestration, or domain mutations.
- Repositories own SQLAlchemy queries and return models/rows; they do not raise HTTP errors.
- Services own domain rules, authorization-sensitive orchestration, commits/rollbacks, audit, and events.
- Presenters own model-to-response mapping.
- Shared backend modules (`core`, `db`, `security`, `ml`, `realtime`) never import domains.
- Cross-domain effects use explicit service interfaces; routers never import other routers.
- Frontend pages compose feature hooks and components; pages do not call raw HTTP helpers.
- Feature `api.ts` modules depend on `lib/http.ts`; shared UI depends on no feature.
- Query owns server state. Zustand owns only cross-route client state. Local state remains local.
- Shared modules never import feature modules.

### 5.4 Naming conventions

- Python modules/functions/variables: `snake_case`.
- Python classes: `PascalCase`; request/response schemas end in `In`/`Out`.
- React components/types: `PascalCase`.
- Hooks: `useX`.
- API functions: `verbNoun`, such as `listIncidents`, `updatePolicy`.
- Query keys and invalidation helpers live with their feature.
- Repository/service classes are introduced only when state or multiple implementations justify them; otherwise modules expose focused functions.
- Temporary compatibility re-exports are marked and removed before completion.

## 6. Backend design

### 6.1 API composition

- `main.py` remains the app factory and owns lifespan, middleware, and exception handlers.
- `api/router.py` creates the single `/api` router and includes domain routers.
- `system` owns `/health`, `/health/ready`, `/health/detailed`, `/settings/info`, and API metadata.
- Existing paths, methods, operation behavior, operation IDs, status codes, and response models remain unchanged.
- OpenAPI output is exported for contract tests and frontend type generation.

### 6.2 Layering

- Router functions handle query/path/body validation, dependencies, and response models.
- Services accept already-resolved identity/auth context and raise `ApiError` for domain failures.
- Repositories expose reusable queries for filtering, counts, pagination, details, and eager loading.
- Write services own the transaction boundary: commit on success, rollback on exception.
- `get_db()` rolls back any uncommitted transaction on exception and always closes the session.
- Read paths do not commit.
- Audit and security-event emission remain within the owning service transaction.
- Export endpoints keep CSV headers, row caps, filenames, correlation IDs, and audit records.

### 6.3 Error handling

- `ApiError` remains the application exception type.
- Add centralized error-code constants to prevent string drift.
- Services translate missing or conflicting domain state into domain-specific `ApiError` codes.
- Repository/database errors propagate to the service or global handler; raw SQL and stack traces never reach clients.
- Integrity/database failures are rolled back and mapped to a safe response.
- Validation remains `422 VALIDATION_ERROR`.
- Unhandled exceptions are logged with request ID and return `500 INTERNAL_ERROR`.
- Existing 401/403/404/409/422/503 behavior is preserved unless a previously unhandled failure requires a safe mapping.
- CSRF, session revocation, WebSocket `4401`, readiness, and audit verification behavior remain unchanged.

### 6.4 Configuration

- Keep all `AEGIS_*` environment names and current defaults.
- Split config internals by runtime, database, auth/session, bootstrap, model, and limits, while exposing one validated `Settings` facade.
- Startup fail-closed validation remains: outside development, demo mode, insecure cookies, and wildcard CORS are rejected.
- Add `docs/CONFIGURATION.md` with every variable, default, production requirement, and secret-handling rule.
- Backend verification continues to use compileall, pytest, pip-audit, and Alembic checks. Add lint/type checks only through tools that are installable and verified on this environment.

### 6.5 Shared backend helpers

- One source of truth for staff/write/all role sets.
- One pagination helper for page/page_size parsing and `Page[T]` construction.
- One ISO-8601 parser with UTC normalization.
- One CSV formula-injection sanitizer and response builder.
- One audit metadata convention.
- Existing policy engine and ML modules remain behaviorally isolated.

## 7. Frontend design

### 7.1 Feature composition

- Each feature owns API calls, query keys/hooks, mutations, selectors/filters, domain components, and pages.
- Pages are orchestration containers; large pages split into page sections, drawers, dialogs, tables, and result views.
- Move page-embedded logic into feature modules:
  - policy draft conversion and preview cases;
  - access filters, evaluation presets, downloads, and detail views;
  - incident mutations, assignment options, and detail panels;
  - overview/chart transformations;
  - identity/device/audit/model view-model adapters.
- The 841-line UI barrel is split into focused files. A temporary barrel preserves imports during migration, then is removed.
- Modal/Drawer focus behavior is consolidated on `useDialogFocus`; duplicate focus trap, Escape, scroll lock, and focus-return logic is removed.
- Target guideline: pages below ~300 lines and feature subcomponents below ~200 lines. This is a review signal, not a blind mechanical limit.

### 7.2 State management

- TanStack Query is the only server-state authority.
- Query keys, mutations, and invalidation helpers live with each feature.
- Realtime invalidation uses a central feature registry instead of duplicating key arrays in `useRealtime`.
- Zustand is added for small cross-route client state:
  - auth/session notice;
  - toast queue;
  - persisted theme/sidebar preferences.
- `useAuth` becomes a thin facade over the session query and auth mutations; consumers migrate incrementally.
- `AuthProvider`, `ToastProvider`, and theme provider nesting is removed after facades/stores stabilize.
- Command palette, mobile-nav visibility, drafts, and other transient state remain local.
- Existing URL search-param filters remain URL-backed.
- Complex forms use local reducers. No second global copy of domain/server data.

### 7.3 Configuration and HTTP

- `config/env.ts` is the only module reading `import.meta.env`.
- It parses and validates API base, WS path, demo enablement, and demo password, exposing a frozen typed config.
- Demo behavior remains identical: explicit enablement or development defaults; the production bundle secret scan remains mandatory.
- Shared `lib/http.ts` owns JSON handling, CSRF headers, credentials, network errors, unauthorized events, downloads, and response parsing.
- Feature `api.ts` modules expose typed calls. Pages never import raw request helpers.
- Backend OpenAPI export generates canonical TypeScript wire types.
- Feature-level narrowing helpers preserve unions such as `Role`, `Decision`, and `RiskCategory`.
- Hand-maintained API wire duplicates are removed. UI-only view models remain handwritten.
- CI/verification fails if generated TypeScript types drift from the exported OpenAPI document.

### 7.4 Error and loading states

- `ApiError` remains the single API error type, with helpers for unauthorized, forbidden, and retryable decisions.
- Route-level error boundaries preserve the app shell and offer retry/reload.
- Feature pages render shared `ErrorState` for query failures.
- Mutation failures always produce safe toasts/messages.
- No silent failures except explicitly optional browser storage, wrapped by `safeStorage`.
- Malformed WebSocket frames are ignored but counted/logged without event contents; revoked sessions still close with `4401`.
- Shared loading, empty, error, modal, drawer, and pagination components replace per-page variants.

## 8. Migration plan

### Phase 0 — Safety baseline

1. Initialize a local git repository.
2. Confirm `.gitignore` excludes secrets, local databases, virtualenv, model artifacts, `node_modules`, `dist`, and test output.
3. Commit the verified current state as the baseline. No remote and no push.
4. Record baseline test counts, build status, and API path/method set.

### Phase 1 — Contract guard

1. Add characterization tests for API paths, response envelopes, role boundaries, CSRF, cookie names, and key SPA routes.
2. Add backend OpenAPI export.
3. Add generated frontend wire types.
4. Verify these tests pass before structural moves.

### Phase 2 — Shared foundations

1. Backend: role/time/CSV/pagination/error-code helpers, DB rollback, config grouping.
2. Frontend: `config/env.ts`, `lib/http.ts`, query-client defaults, Zustand stores, route error boundary, and split UI primitives.
3. Keep compatibility exports while consumers migrate.

### Phase 3 — Backend domain extraction

Order:

1. `audit`, `events`
2. `auth`, `system`
3. `identities`, `devices`
4. `access`, `policies`
5. `incidents`, `overview`, `model`, `demo`

For each slice:

- move router/schemas/service/repository/presenters;
- preserve old import locations temporarily;
- run focused tests, full backend suite, Alembic check, pip-audit, and OpenAPI contract test;
- verify no SQL remains in routers and no duplicated helper was reintroduced.

### Phase 4 — Frontend feature extraction

Order:

1. `auth` and app shell
2. `settings`, `employee`, `overview`, `demo`
3. `identities`, `devices`, `events`, `audit`, `model`
4. `access`, `policies`, `incidents`

For each slice:

- move page/container/components/model/queries;
- replace direct page API imports with hooks;
- consolidate duplicated UI states;
- run typecheck, unit tests, production build, secret scan, and Playwright.

### Phase 5 — Cleanup

1. Remove compatibility re-exports and old folders/files.
2. Remove unused exports and duplicate helpers only after import analysis and test proof.
3. Enable TypeScript `noUnusedLocals` and `noUnusedParameters`.
4. Add import-boundary checks:
   - no SQL or commits in routers;
   - no `import.meta.env` outside `config/env.ts`;
   - no raw HTTP imports in pages;
   - no shared-to-domain imports;
   - no router-to-router imports.

### Phase 6 — Documentation and final verification

1. Add `docs/CODEBASE.md`, `docs/CONVENTIONS.md`, `docs/CONFIGURATION.md`, and an ADR for the modular monolith.
2. Add concise backend/frontend domain maps with responsibilities and allowed dependencies.
3. Document public service/repository interfaces and non-obvious transforms.
4. Update README, ARCHITECTURE, API, THREAT_MODEL, and DEMO_GUIDE.
5. Run the complete verification suite.

## 9. Testing strategy

### Backend

- Characterization tests before moving: paths, methods, envelopes, errors, roles, CSRF, redirects, readiness, WebSocket close codes.
- OpenAPI contract test against an explicit path/method allowlist.
- Domain tests for extracted services/repositories.
- Full pytest suite after every phase.
- Compileall, pip-audit, Alembic `upgrade head`/`check`.

### Frontend

- Unit tests for env parsing, HTTP/error handling, stores, feature models, and critical components.
- Existing App, API, navigation, utility, UI, and dialog-focus tests remain green.
- Typecheck and production build after every phase.
- Bundle secret scan after every production build.
- Playwright login, role containment, and staff-surface tests after every phase.
- Generated OpenAPI type drift check.
- Import-boundary scan for the rules in Phase 5.

### Manual/local

- Verify demo login, role-specific navigation, access evaluation, policy preview/update, incident update/note, CSV export, realtime reconnect, and audit verification.
- Do not claim Docker/PostgreSQL verification.

## 10. Documentation deliverables

- `docs/CODEBASE.md`: directory map, dependency rules, request lifecycle, where to add features.
- `docs/CONVENTIONS.md`: naming, layering, state, errors, configuration, testing, and import rules.
- `docs/CONFIGURATION.md`: complete environment reference and production checklist.
- `docs/decisions/0001-feature-first-modular-monolith.md`: rationale and trade-offs.
- `backend/app/domains/README.md`: domain responsibilities and dependency direction.
- `frontend/src/features/README.md`: feature ownership and shared-layer rules.
- Updated README, ARCHITECTURE, API, THREAT_MODEL, and DEMO_GUIDE.
- Docstrings only for public interfaces and non-obvious logic; avoid comment noise.

## 11. Acceptance criteria

- All existing API paths, schemas, role rules, cookies, decision semantics, SPA routes, and demo flows are unchanged.
- No direct `import.meta.env` usage outside `config/env.ts`.
- No SQL or transaction orchestration in routers.
- No raw HTTP calls in pages.
- No duplicate role lists, pagination logic, CSV sanitizers, focus traps, error renderers, or hand-maintained API wire types within the same layer.
- Cross-language role/schema semantics are covered by the generated OpenAPI contract and integration tests, not by copying implementation constants.
- Generated API types match exported OpenAPI.
- Backend: 79+ tests pass; compileall, pip-audit, Alembic checks pass.
- Frontend: 20+ tests pass; typecheck, production build, secret scan, npm audit, and 3 Playwright tests pass.
- Documentation explains where new backend domains and frontend features belong.
- Docker/PostgreSQL remains explicitly unverified unless executed on a Docker host.

## 12. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Large import churn breaks behavior | Strangler migration, compatibility re-exports, full suite after each slice |
| No version-control history | Local git baseline before implementation |
| Transaction behavior changes | Services own commits; characterization tests for writes/exports/audit |
| Generated types lose frontend unions | Narrowing helpers per feature; contract tests |
| Zustand duplicates server state | Server data only in TanStack Query; review state ownership |
| Dead-code removal deletes live behavior | Evidence-driven policy; import/build/test proof; flag ambiguity |
| Refactor time expands | Phase gates; each domain independently verifiable |
| Docker remains unverified | Explicit limitation; no false completion claims |

## 13. Decisions

- Preserve external behavior and interfaces.
- Use feature-first structure in a modular monolith.
- Keep `/api/*` without versioning.
- Use TanStack Query plus scoped Zustand stores.
- Remove duplication/dead code only with evidence.
- Generate frontend wire types from backend OpenAPI.
- Document architecture and module guides rather than exhaustive inline comments.
- Establish a local git baseline before implementation.

## 14. Open questions

None. Implementation planning can begin after written-spec review.
