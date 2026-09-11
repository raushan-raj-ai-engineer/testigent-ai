# Add a New Project

Create a project skeleton instead of copying another team’s implementation:

```bash
npm run project:new -- project2
```

Then edit `projects/project2/config/qa.json` with the project’s UI/API endpoints and auth strategy.

## Project-owned code

Put selectors/actions in `src/pages`, business journeys in `src/workflows`, endpoint-specific services in `src/api`, domain SQL/repositories in `src/database`, input datasets in `data`, requirements in `requirements`, and executable specs in `tests`.

Do not put application selectors, endpoint paths, table names, domain payloads, or business workflows inside `src/framework`.

## Project fixture

`projects/project2/fixtures/test.fixture.ts` extends the reusable enterprise fixture. Add project facades/services there so tests can use typed fixtures without coupling to another project.

## Validate onboarding

```bash
npm run architecture:check
APP=project2 ENV=qa npm run project:check
APP=project2 ENV=qa npm run test:project -- --project=chromium
```

A new project should not require any modification to reusable framework source unless the team is adding a capability that is genuinely generic for all projects.


## Team handoff

Use `15-NEW-PROJECT-HANDOFF.md` as the onboarding checklist. It includes agent/MCP authoring, validation, project ownership boundaries and evidence-based productivity reporting.


## Database capability policy

Database use is project/environment configurable and is enforced by the reusable framework. `projects/<project>/project.json` declares whether database validation is required; `projects/<project>/config/<env>.json` selects the database type (`none`, `postgres`, `mysql`, or `mssql`). `DB_TYPE` may override the configured type in CI/local runtime, while database credentials remain secret environment variables.

- optional + unavailable: tests tagged `@db` are skipped automatically with a clear reason; UI/API suites continue
- configured and ready: `@db` tests execute normally
- required + unavailable: `qa:doctor`, framework health and project preflight fail before Playwright execution

Business specs must not read `DB_TYPE` or manually decide whether to skip. Tag any scenario that requires database access with `@db`; the framework owns capability gating.
