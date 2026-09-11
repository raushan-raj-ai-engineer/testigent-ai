# __PROJECT__

Project-owned automation only. Reusable engines belong in `src/framework`; do not copy framework utilities into this directory.

## New joiner workflow

```bash
npm ci
npm run qa:use -- __PROJECT__ qa
npm run qa:doctor
npm run qa:test -- --project=chromium --grep @smoke
```

For a requirement under `requirements/<feature>.md`:

```bash
npm run qa:new -- <feature>
```

The daily authoring contract is intentionally small:

- `config/` owns environment/application values.
- `fixtures/` injects project domain facades.
- `src/pages/` owns UI mechanics and `LocatorPlan` definitions.
- `src/workflows/` owns business journeys.
- `src/api/` owns domain API services.
- `src/database/` owns domain repositories/SQL.
- `data/` owns project test data.
- `tests/` expresses business intent with project fixtures and `test.step()`.
- `tests/_agent/seed.spec.ts` is the Playwright Planner/Generator seed example.

Normal business specs should not construct `HealingOrchestrator`, `BaseApiClient`, database clients, AI providers, or `ApplicationRegistry`, and should not contain raw `page.click/fill/locator/getByRole` actions.

Before handing this project to another team, follow `docs/15-NEW-PROJECT-HANDOFF.md`.


## Database capability policy

Database use is project/environment configurable and is enforced by the reusable framework. `projects/<project>/project.json` declares whether database validation is required; `projects/<project>/config/<env>.json` selects the database type (`none`, `postgres`, `mysql`, or `mssql`). `DB_TYPE` may override the configured type in CI/local runtime, while database credentials remain secret environment variables.

- optional + unavailable: tests tagged `@db` are skipped automatically with a clear reason; UI/API suites continue
- configured and ready: `@db` tests execute normally
- required + unavailable: `qa:doctor`, framework health and project preflight fail before Playwright execution

Business specs must not read `DB_TYPE` or manually decide whether to skip. Tag any scenario that requires database access with `@db`; the framework owns capability gating.
