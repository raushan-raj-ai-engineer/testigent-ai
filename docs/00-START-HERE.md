# Start Here

TestigentAI is a reusable Playwright + TypeScript quality platform. Reusable engines live in `src/framework/`; application behavior lives only in `projects/<project>/`.

## First-time setup

```bash
npm ci
npx playwright install chromium
npm run project:list
npm run qa:use -- <project> <environment>
npm run qa:doctor
```

`qa:use` stores the local selection in `.runtime/workspace.json` (gitignored). CI must provide `APP` and `ENV` explicitly. The framework has no silent `demo/qa` runtime fallback.

## Daily flow — five commands

```bash
npm run qa:status
# auth-required projects only: npm run qa:auth

Auth capture is verified in a fresh browser context before it is promoted. The framework also restores a gitignored sessionStorage companion when required and raises `AUTH_SESSION_INVALID` before locator healing if the selected session is no longer authenticated.
npm run qa:new -- <requirement-id-or-file>
npm run qa:test -- --project=chromium
npm run qa:validate
npm run qa:report
npm run qa:heal
```

Use `qa:validate -- --with-tests` when you also want the selected project's Chromium suite.

## New test rule

Normal business tests use project fixtures/facades (`app`, `api`, `repositories`, `data`). They do not instantiate framework infrastructure and do not contain raw `page.goto/locator/click/fill` actions.

```text
Test -> project fixture/facade -> workflow/domain service -> page/repository -> reusable framework
```

For authenticated projects, `qa:doctor` fails until the configured storage-state file exists. Create/refresh it through the governed auth flow; never commit `.auth/`.

Never commit `.auth`, `.env`, reports, test results, healing/cache/runtime files, or captured application evidence.

Read next: `01-ARCHITECTURE.md`, `02-DAILY-COMMANDS.md`, `15-NEW-PROJECT-HANDOFF.md`, and `16-PLAYWRIGHT-AGENTS-PRODUCTIVITY.md`.


## Database capability policy

Database use is project/environment configurable and is enforced by the reusable framework. `projects/<project>/project.json` declares whether database validation is required; `projects/<project>/config/<env>.json` selects the database type (`none`, `postgres`, `mysql`, or `mssql`). `DB_TYPE` may override the configured type in CI/local runtime, while database credentials remain secret environment variables.

- optional + unavailable: tests tagged `@db` are skipped automatically with a clear reason; UI/API suites continue
- configured and ready: `@db` tests execute normally
- required + unavailable: `qa:doctor`, framework health and project preflight fail before Playwright execution

Business specs must not read `DB_TYPE` or manually decide whether to skip. Tag any scenario that requires database access with `@db`; the framework owns capability gating.
