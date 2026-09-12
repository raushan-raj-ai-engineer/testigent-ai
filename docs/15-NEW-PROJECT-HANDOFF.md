# New Project Handoff

A new team should add project-owned configuration and domain automation without copying or modifying reusable framework engines.

## 1. Create and select

```bash
npm run project:new -- project2
npm run qa:use -- project2 qa
npm run qa:doctor
```

The project template already includes the project fixture, `AppFacade`, Page/Workflow scaffolding, API/repository facades, a facade-first smoke test and `tests/_agent/seed.spec.ts`.

## 2. Configure

Edit `projects/project2/config/qa.json` for non-secret UI/API URLs and auth strategy. Organization-wide Playwright policy belongs in `config/organization.json`; project exceptions belong in `project.json` or environment config. Secrets belong only in local `.env` or CI secret stores.

## 3. Configure reusable authentication when needed

If the application supports non-interactive login/refresh, copy `templates/project/auth/auth.provider.example.ts` to `projects/project2/auth/auth.provider.ts`, implement the project-specific auth call, and reference it through `auth.lifecycle.providerModule`. Framework core owns freshness/locking/verification; the project owns credentials, endpoints and token mapping.

```bash
APP=project2 ENV=qa npm run auth:check
APP=project2 ENV=qa npm run auth:prepare
```

If MFA or policy prevents non-interactive refresh, keep `autoRefresh` disabled and use the governed `qa:auth` capture flow. Never commit `.auth/` or private credentials.

## 4. Add domain automation

```text
pages       UI mechanics + semantic LocatorPlan
workflows   reusable business journeys
api         business API services/facade
database    domain repositories/facade
data        project-owned datasets
tests       business intent and assertions only
```

Normal specs consume `app`, `api`, `repositories`, and reusable data fixtures. They do not instantiate framework infrastructure.

## 5. Agent-assisted UI / API / DB / E2E authoring

Place a requirement under `projects/project2/requirements/` and run:

```bash
npm run qa:new -- feature
```

The same entry point is layer-aware:

- UI proposals use project Page -> Workflow -> Facade boundaries and deterministic-first/lazy-AI healing.
- API proposals use approved contracts/evidence and project domain services; agents must not invent endpoints, payloads or status expectations.
- Database proposals use approved schema evidence and project repositories; generated validation is read-only by default.
- Mixed E2E proposals correlate the same business identifiers across layers.

Agents start from `projects/project2/tests/_agent/seed.spec.ts`. Discovery evidence may contain raw Playwright/tool actions, but promoted TestigentAI code must follow project architecture. Every generated proposal remains blocked until validation succeeds and a named human reviewer approves it. See `29-AGENT-AUTHORING-UI-API-DB-E2E.md`.

## 6. Portfolio readiness

The project is automatically discoverable by the portfolio runner once its config exists:

```bash
npm run test:projects -- --all --env=qa --dry-run --project=chromium
```

If this product belongs to a customer estate, add it to `config/project-groups.json`. No framework-core edit is required. Portfolio execution produces a machine-readable summary and a business-first dashboard under `reports/multi-project/<RUN_ID>/`.

## 7. Validate before PR

```bash
npm run qa:validate
npm run qa:test -- --project=chromium --grep @smoke
```

CI must set `APP` and `ENV` explicitly. A project is not allowed to depend on another project's code.


Recovery boundaries are documented in `30-RECOVERY-ARCHITECTURE.md`; UI locator healing, authentication recovery, API resilience and database resilience intentionally have different safety rules.
