# Start Here

TestigentAI is a reusable Playwright + TypeScript quality platform. Reusable engines live in `src/framework/`; application behavior lives only in `projects/<project>/`.

Current certified baseline: **v1.6.0** on Node.js 22.x. The main CI and 5/5 tag-triggered release-compatibility matrix are green; see `41-CURRENT-RELEASE-STATUS.md`.

## First-time setup

Contributor prerequisite: install Git and GitHub CLI (`gh`) when you need branch/PR/Actions/release operations. See `40-GIT-GITHUB-CLI-TERMINAL-GUIDE.md` for macOS/Windows/Linux setup and `gh auth login`.

```bash
npm ci
npx playwright install chromium
npm run project:list
npm run qa:use -- <project> <environment>
npm run qa:doctor
```

`qa:use` stores the local selection in `.runtime/workspace.json` (gitignored). CI must provide `APP` and `ENV` explicitly. The framework has no silent `demo/qa` runtime fallback.

## Daily flow — small command surface

```bash
npm run qa:status
npm run qa:new -- <requirement-id-or-file>
npm run qa:test -- --project=chromium
npm run qa:validate
npm run qa:report
```

For auth-required products, use `npm run qa:auth` when an interactive capture/refresh is required. Auth capture is verified in a fresh browser context before promotion. The framework can also restore a gitignored sessionStorage companion when required and raises `AUTH_SESSION_INVALID` before locator healing if the selected session is no longer authenticated.

Use `qa:validate -- --with-tests` when you also want the selected project's Chromium suite. Use `npm run qa:heal` for governed source-healing review when a maintained test needs a proposed code change.

For customers with multiple products, use the portfolio runner rather than scripting project loops yourself:

```bash
npm run test:projects -- --all --env=qa --dry-run --project=chromium
npm run test:projects -- --group=<customer-group> --profile=regression --project=chromium
```

## New test rule

Normal business tests use project fixtures/facades (`app`, `api`, `repositories`, `data`). They do not instantiate framework infrastructure and do not contain raw `page.goto/locator/click/fill` actions.

```text
Test -> project fixture/facade -> workflow/domain service -> page/repository -> reusable framework
```

For authenticated projects, `qa:doctor` fails until the configured storage-state file exists. Create/refresh it through the governed auth flow; never commit `.auth/`.

Never commit `.auth`, `.env`, reports, test results, healing/cache/runtime files, or captured application evidence.

Read next: `01-ARCHITECTURE.md`, `02-DAILY-COMMANDS.md`, `40-GIT-GITHUB-CLI-TERMINAL-GUIDE.md`, `41-CURRENT-RELEASE-STATUS.md`, `15-NEW-PROJECT-HANDOFF.md`, `18-MULTI-PROJECT-EXECUTION.md`, `29-AGENT-AUTHORING-UI-API-DB-E2E.md`, and `30-RECOVERY-ARCHITECTURE.md`.


## Database capability policy

Database use is project/environment configurable and is enforced by the reusable framework. `projects/<project>/project.json` declares whether database validation is required; `projects/<project>/config/<env>.json` exclusively selects the database type (`none`, `postgres`, `mysql`, or `mssql`). Repository or machine-level `DB_TYPE` values do not override another project's capability; only DB connection secrets such as `DB_HOST`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` come from the environment.

- optional + unavailable: tests tagged `@db` are skipped automatically with a clear reason; UI/API suites continue
- configured and ready: `@db` tests execute normally
- required + unavailable: `qa:doctor`, framework health and project preflight fail before Playwright execution

Business specs must not read `DB_TYPE` or manually decide whether to skip. Tag any scenario that requires database access with `@db`; the framework owns capability gating.
