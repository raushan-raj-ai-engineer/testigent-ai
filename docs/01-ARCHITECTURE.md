# Architecture

## Ownership model

```text
testigent-ai/
├── src/framework/                 reusable platform only
│   ├── core/                      config, fixtures, setup, paths, known defects
│   ├── api/                       generic API client/auth/schema utilities
│   ├── database/                  generic DB clients/factory
│   ├── data/                      JSON/CSV/XLSX/YAML readers and factories
│   ├── reporting/                 Playwright/business dashboard/report writers
│   ├── analytics/                 execution facts, clustering, flakiness
│   ├── logging/                   structured logging/redaction
│   ├── notifications/             email/report notification infrastructure
│   ├── healing/                   guarded deterministic-first healing
│   ├── ai/                        provider abstraction/governance
│   └── intelligence/              requirements, application knowledge, connectors
├── projects/
│   ├── demo/
│   └── sdet-practice/
│       ├── config/<env>.json
│       ├── fixtures/test.fixture.ts
│       ├── requirements/
│       ├── data/
│       ├── src/pages/
│       ├── src/workflows/
│       ├── src/api/
│       ├── src/database/
│       ├── tests/
│       └── known-defects.json
├── templates/project/             clean onboarding skeleton
├── tests/framework/               framework-only regression
├── scripts/                       generic operational CLIs
└── docs/
```

The reusable framework must never import a concrete project. Project fixtures extend the reusable fixture and inject project facades. This inversion keeps Team A and Team B isolated while sharing the same tested engines.

## Test dependency direction

```text
project test
  -> project fixture/facade
  -> project workflow / API service / DB repository
  -> project page objects
  -> src/framework reusable utilities
```

Project-to-project imports are prohibited. `npm run architecture:check` enforces this contract.

## Configuration

`APP=<name>` selects `projects/<name>`. `ENV=<name>` selects `projects/<name>/config/<env>.json`. The project config owns UI/API endpoints and auth strategy. `APP_BASE_URL` may override the configured UI URL for temporary execution; it should not become the normal configuration mechanism.

## Framework validation vs application validation

`npm run validate:final` validates framework health, architecture, TypeScript, and framework contracts against the deterministic `demo` project. Real AUT suites run separately through `test:project`. Known application defects are tracked project-side and never converted into framework bugs.
