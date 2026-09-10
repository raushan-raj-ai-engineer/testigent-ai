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
