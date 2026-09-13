# Architecture

Current certified baseline: **v1.5.3**. The architecture below is the active mainline structure; release-specific historical corrections are documented separately.

## Ownership model

```text
src/framework/                    reusable platform only
  core/config                     workspace + runtime configuration
  core/fixtures                   reusable Playwright dependency injection
  api / database / data           generic engines
  reporting / logging             shared observability
  healing / ai                    governed recovery/provider abstractions
  intelligence                    requirement/knowledge/agent support

projects/<project>/               application-owned automation only
  config/<env>.json               URLs, auth strategy, env-specific non-secrets
  project.json                    project policy overrides
  fixtures/test.fixture.ts        project dependency boundary
  src/app.facade.ts               discoverable business entry point
  src/pages/                      UI mechanics + LocatorPlan
  src/workflows/                  business journeys
  src/api/                        domain API services/facade
  src/database/                   domain repositories/facade
  data/                           project test data
  tests/_agent/seed.spec.ts       Playwright-agent setup/fixture seed
  tests/                          business and governed capability specs
```

## Dependency direction

```text
business spec
  -> project fixture
  -> app/api/repository facade
  -> workflow/domain service
  -> page/repository
  -> src/framework reusable engines
```

Reusable framework code never imports a project. Projects never import sibling projects. `npm run architecture:check` enforces these boundaries and also rejects raw UI actions, direct framework-service construction, direct APP/ENV reads, absolute URLs, and credential-like literals in ordinary project specs.

## Configuration resolution

All runtime consumers use the same target resolution:

```text
explicit APP/ENV (CI or one-off command)
             ↓
.runtime/workspace.json (local qa:use selection)
             ↓
single-environment inference where unambiguous
             ↓
clear error — never demo/qa fallback
```

Runtime policy is then layered:

```text
config/organization.json
  -> projects/<project>/project.json
  -> projects/<project>/config/<env>.json
  -> environment-variable overrides
  -> command/CLI overrides
```

`playwright.config.ts` is a thin adapter over `RuntimeConfig`. Organization config owns default browsers/artifact policy; project/environment layers override only where needed. Secrets stay in local `.env` or CI secret stores, never project JSON.

## What “no hardcoding” means

Environment-dependent values must be configurable: URLs, credentials/tokens, DB settings, auth state, browsers, timeouts, retries/workers, artifacts, AI/healing policy, external integrations and feature flags.

Project business knowledge belongs in project code. A semantic `LocatorPlan` such as “Create User button” is valid project knowledge; moving every selector string to JSON would reduce type safety and maintainability.

## Healing ownership

Runtime healing recovers a locator during execution and records evidence; it does not edit source. `qa:heal` turns repeated recovery evidence into a review-only source-maintenance proposal. Source healing must never weaken business/API/DB/security expectations or hide defects with skip/fixme.
