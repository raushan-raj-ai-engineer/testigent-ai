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

## 5. Agent-assisted new test

Place a requirement under `projects/project2/requirements/` and run:

```bash
npm run qa:new -- feature
```

Agents start from `projects/project2/tests/_agent/seed.spec.ts`. Planner/browser evidence may contain raw Playwright actions; production TestigentAI code must be mapped into Page -> Workflow/Domain Service -> Facade -> Business Spec before promotion.

## 6. Validate before PR

```bash
npm run qa:validate
npm run qa:test -- --project=chromium --grep @smoke
```

CI must set `APP` and `ENV` explicitly. A project is not allowed to depend on another project's code.
