# UI, API, Database and Data

## UI

Project page objects own locators and atomic UI actions. Workflows own business journeys. Prefer user-visible roles/labels/test IDs and Playwright web-first assertions. Fixed sleeps are not a synchronization strategy.

## API

`src/framework/api` contains transport, authentication and generic validation. Project endpoint routes/payload/domain services belong under `projects/<project>/src/api`.

Use API validation for status/headers/schema/business data and for efficient test setup/cleanup when supported by the product.

## Database

`src/framework/database` owns connection factories/clients. SQL tied to a product domain belongs in the project repository. If database validation is disabled, `NullDatabaseClient` fails explicitly instead of silently returning fake results.

## Data-driven tests

Reusable readers support structured sources; project datasets stay under `projects/<project>/data`. Use JSON for hierarchical payloads, CSV for simple tabular business cases, YAML for readable structured configuration/test cases where appropriate, and XLSX only when spreadsheet input is a real stakeholder requirement.

Keep secrets out of test data files.


## Database capability policy

Database use is project/environment configurable and is enforced by the reusable framework. `projects/<project>/project.json` declares whether database validation is required; `projects/<project>/config/<env>.json` selects the database type (`none`, `postgres`, `mysql`, or `mssql`). `DB_TYPE` may override the configured type in CI/local runtime, while database credentials remain secret environment variables.

- optional + unavailable: tests tagged `@db` are skipped automatically with a clear reason; UI/API suites continue
- configured and ready: `@db` tests execute normally
- required + unavailable: `qa:doctor`, framework health and project preflight fail before Playwright execution

Business specs must not read `DB_TYPE` or manually decide whether to skip. Tag any scenario that requires database access with `@db`; the framework owns capability gating.
