# Add a New Project

TestigentAI is designed so a customer can onboard a new product without copying framework internals or editing reusable core code.

## Five-minute onboarding path

Create a project skeleton:

```bash
npm run project:new -- project2
```

Configure the first environment in `projects/project2/config/qa.json` with non-secret application values such as UI/API URLs and the authentication strategy.

Select and validate it:

```bash
npm run qa:use -- project2 qa
npm run qa:doctor
```

If the product requires authentication, configure the project-owned auth provider or use the governed `qa:auth` flow before running tests.

Add a requirement under `projects/project2/requirements/` and start the normal governed authoring flow:

```bash
npm run qa:new -- <requirement-id-or-file>
```

`qa:new` is layer-aware. The same workflow can propose UI, API, database, or mixed E2E automation. Generated code remains review-blocked until a human explicitly approves and promotes it.

Validate and execute:

```bash
npm run qa:validate
npm run qa:test -- --project=chromium
```

No reusable framework source should need to change for a normal customer/product onboarding.

## Project-owned code

Keep application knowledge inside the project boundary:

```text
projects/project2/
├── config/          environment/application configuration
├── auth/            optional project authentication adapter
├── fixtures/        typed project fixtures/facades
├── requirements/    business requirements used for governed authoring
├── data/            project-owned datasets
├── src/
│   ├── pages/       UI mechanics + LocatorPlan definitions
│   ├── workflows/   reusable business journeys
│   ├── api/         domain API services
│   └── database/    domain repositories / SQL
└── tests/           business-readable executable specifications
```

Do not put application selectors, endpoint paths, table names, domain payloads, or business workflows inside `src/framework`.

## Project fixture

`projects/project2/fixtures/test.fixture.ts` extends the reusable enterprise fixture. Add project facades/services there so tests consume typed business capabilities without coupling to framework internals or another project.

## Agent-assisted UI / API / DB / E2E authoring

Use approved evidence for the target layer:

- UI: requirement + live page evidence / CLI / MCP / Playwright agents.
- API: approved OpenAPI/Swagger/Postman/contracts or observed service evidence.
- Database: approved schema/repository evidence. Agent-generated database validation is read-only by default.
- E2E: correlate the same business identifiers across UI/API/DB rather than creating unrelated checks.

The lifecycle stays intentionally simple:

```text
Requirement + approved evidence
        ↓
qa:new
        ↓
review-blocked proposal
        ↓
automated validation
        ↓
human approval
        ↓
promotion
        ↓
normal CI + reporting
```

See `29-AGENT-AUTHORING-UI-API-DB-E2E.md` for the detailed contract.

## Validate onboarding

```bash
npm run architecture:check
APP=project2 ENV=qa npm run project:check
APP=project2 ENV=qa npm run test:project -- --project=chromium
```

A new project should not require any modification to reusable framework source unless the team is adding a capability that is genuinely generic for all projects.

## Automatic portfolio discovery

Once a valid project/environment configuration exists, portfolio execution can discover it automatically:

```bash
npm run test:projects -- --all --env=qa --dry-run --project=chromium
```

For one customer with several products, add a named group in `config/project-groups.json` and execute the group without changing framework code.

## Team handoff

Use `15-NEW-PROJECT-HANDOFF.md` as the onboarding checklist. It covers project ownership, authentication, agent-assisted authoring, validation, portfolio execution and reporting.

## Database capability policy

Database use is project/environment configurable and is enforced by the reusable framework. `projects/<project>/project.json` declares whether database validation is required; `projects/<project>/config/<env>.json` exclusively selects the database type (`none`, `postgres`, `mysql`, or `mssql`). Repository or machine-level `DB_TYPE` values do not override another project's capability; only DB connection secrets such as `DB_HOST`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` come from the environment.

- optional + unavailable: tests tagged `@db` are skipped automatically with a clear reason; UI/API suites continue
- configured and ready: `@db` tests execute normally
- required + unavailable: `qa:doctor`, framework health and project preflight fail before Playwright execution

Business specs must not read `DB_TYPE` or manually decide whether to skip. Tag any scenario that requires database access with `@db`; the framework owns capability gating.
