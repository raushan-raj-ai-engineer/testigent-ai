# Daily Commands

## Recommended new-joiner surface

```bash
npm ci
npx playwright install chromium
npm run qa:use -- <project> <environment>
npm run qa:doctor
npm run qa:status
# if qa:doctor reports missing required auth:
# npm run qa:auth

Auth capture is verified in a fresh browser context before it is promoted. The framework also restores a gitignored sessionStorage companion when required and raises `AUTH_SESSION_INVALID` before locator healing if the selected session is no longer authenticated.
```

Create a test from a requirement:

```bash
npm run qa:new -- checkout
# or
npm run qa:new -- projects/<project>/requirements/checkout.md
```

Run and validate:

```bash
npm run qa:test -- --project=chromium
npm run qa:validate
npm run qa:validate -- --with-tests
npm run qa:report
```

Build source-healing maintenance candidates from repeated runtime recovery evidence:

```bash
npm run qa:heal
```

Initialize the selected Playwright coding-agent loop when needed:

```bash
npm run qa:agents -- vscode
# codex | claude | opencode are also supported when installed/approved
```

## One-off / CI overrides

Local developers normally use `qa:use`. CI is explicit:

```bash
APP=project2 ENV=qa npm run test:project -- --project=chromium
APP=project2 ENV=qa npm run validate:final
```

There is intentionally no default project/environment in reusable runtime code.

## Advanced commands

The repository still exposes specialized commands (`test:ui`, `test:api`, `test:db`, requirement/proposal tools, scenario authoring, reporting and AI checks). These are implementation building blocks and advanced workflows; a new joiner should begin with `qa:*` rather than learning the entire command catalog.

## Authentication

`qa:doctor` reports whether the selected project's configured storage state is ready. For projects that require it, use the governed `app:auth` flow with the selected project and never commit `.auth/`.


## Database capability policy

Database use is project/environment configurable and is enforced by the reusable framework. `projects/<project>/project.json` declares whether database validation is required; `projects/<project>/config/<env>.json` selects the database type (`none`, `postgres`, `mysql`, or `mssql`). `DB_TYPE` may override the configured type in CI/local runtime, while database credentials remain secret environment variables.

- optional + unavailable: tests tagged `@db` are skipped automatically with a clear reason; UI/API suites continue
- configured and ready: `@db` tests execute normally
- required + unavailable: `qa:doctor`, framework health and project preflight fail before Playwright execution

Business specs must not read `DB_TYPE` or manually decide whether to skip. Tag any scenario that requires database access with `@db`; the framework owns capability gating.
