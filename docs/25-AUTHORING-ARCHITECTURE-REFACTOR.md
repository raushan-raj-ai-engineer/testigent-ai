# Test Authoring Architecture Refactor — 2026-09-11

## Goal

Make normal automation development simple and project-safe without removing the enterprise capabilities already present in TestigentAI. A new joiner should work through a small domain-facing surface while reusable framework services remain infrastructure.

## Implemented architecture

### 1. One runtime target

`WorkspaceContext` and `RuntimeConfig` now centralize project/environment and Playwright-policy resolution. Local developers select once with `qa:use`; CI supplies `APP` and `ENV` explicitly. Reusable runtime code does not silently fall back to `demo/qa`.

Resolution order:

```text
explicit APP/ENV -> local .runtime/workspace.json -> safe single-environment inference -> error
```

Configuration policy layers:

```text
config/organization.json
 -> projects/<project>/project.json
 -> projects/<project>/config/<environment>.json
 -> environment overrides
 -> CLI overrides
```

Artifact-only services (healing/audit/history) use `application.scope.ts`, which deliberately needs only an application namespace and therefore does not force framework contract tests to invent a real environment.

### 2. Facade-first test authoring

Normal business tests consume project fixtures/facades (`app`, `api`, `repositories`, `data`). UI mechanics stay in Page Objects/`LocatorPlan`; reusable business journeys stay in workflows; SQL/API details stay in project domain services. Normal specs do not instantiate framework infrastructure.

The project template now creates:

- `src/app.facade.ts`
- `src/pages/home.page.ts`
- `src/workflows/home.workflow.ts`
- API/repository facades
- project fixture
- facade-first smoke spec
- `tests/_agent/seed.spec.ts`

### 3. Thin daily CLI

Recommended commands:

```bash
npm run qa:use -- <project> <environment>
npm run qa:doctor
npm run qa:auth                # only when configured auth is required

Auth capture is verified in a fresh browser context before it is promoted. The framework also restores a gitignored sessionStorage companion when required and raises `AUTH_SESSION_INVALID` before locator healing if the selected session is no longer authenticated.
npm run qa:new -- <requirement>
npm run qa:test -- --project=chromium
npm run qa:validate
npm run qa:report
npm run qa:heal
```

Advanced scripts remain available for architects and specialized workflows but are no longer the onboarding path.

### 4. Enforced authoring contract

`architecture:check` validates project contract files and blocks ordinary project specs from using raw Playwright UI actions, constructing healer/AI/API/DB infrastructure, reading APP/ENV directly, embedding absolute URLs, or embedding credential-like literals. Explicit framework-capability exceptions are configured with rule-level reasons in `config/architecture.json`; they are not hidden in source code.

### 5. Agent-assisted development

Every project has `tests/_agent/seed.spec.ts`. Planner/Generator browser evidence is treated as evidence, not automatically as final architecture. The required mapping is:

```text
Planner + project seed
 -> live browser evidence (CLI/MCP/Generator)
 -> Page LocatorPlan
 -> Workflow/domain service
 -> project facade
 -> business spec
 -> validation + human review
```

`TESTIGENTAI ENTERPRISE QUALITY OVERLAY V2` enforces the same rules in repository agent definitions.

### 6. Healing split

Runtime healing may recover a locator and record evidence; it never edits source. `qa:heal` ranks repeated recoveries and writes a review-only source-maintenance prompt. Source healing may propose locator/scoping/synchronization changes, but may not weaken business/API/DB/security assertions or hide defects with skip/fixme.

## Security/packaging

Review/release archives must not contain `.auth/`, `.env`, `.runtime/`, `.healing/`, `.report-history/`, reports, test results, `node_modules`, browser reports, coverage/build output, or local proposal/application-knowledge state. The uploaded auth-state artifact was excluded from the final package.

## Self-validation performed in the implementation environment

Passed:

- `release-static-check.mjs`
- enhanced `architecture-check.ts`
- TypeScript syntax/transpile diagnostics across all repository `.ts` sources
- semantic TypeScript check for the new config/execution core using the available global compiler/types
- runtime fail-safe with no selected project
- local workspace selection and explicit CI override precedence
- Playwright policy environment override resolution
- `project-check` and `framework-health` runtime checks for `demo/qa`
- `qa:status` and `qa:doctor` for a ready project
- negative `qa:doctor` check for required missing auth state
- clean project-template generation + architecture validation
- agent policy idempotence (`updated=0` on second application)
- YAML parsing for GitHub/Azure pipelines
- package.json/package-lock dependency consistency
- hardcoded runtime project/environment scan

Environment limitation:

`npm ci` could not complete in the implementation container because the npm registry package tarballs were unavailable (`ENOTCACHED` for locked dependency `zod@4.5.4`; online restore timed out). Therefore dependency-backed `npm run typecheck` and Playwright browser regression were not falsely reported as executed here. They remain mandatory on the normal development/CI machine:

```bash
npm ci
npx playwright install chromium
npm run qa:use -- demo qa
npm run qa:validate -- --with-tests
```

CI should run with explicit `APP` and `ENV` variables.


## Database capability policy

Database use is project/environment configurable and is enforced by the reusable framework. `projects/<project>/project.json` declares whether database validation is required; `projects/<project>/config/<env>.json` selects the database type (`none`, `postgres`, `mysql`, or `mssql`). `DB_TYPE` may override the configured type in CI/local runtime, while database credentials remain secret environment variables.

- optional + unavailable: tests tagged `@db` are skipped automatically with a clear reason; UI/API suites continue
- configured and ready: `@db` tests execute normally
- required + unavailable: `qa:doctor`, framework health and project preflight fail before Playwright execution

Business specs must not read `DB_TYPE` or manually decide whether to skip. Tag any scenario that requires database access with `@db`; the framework owns capability gating.

## v1.2.2 semantic healing refinement

Healing success is no longer inferred from "locator visible + click/fill completed". Critical Page Object actions can attach a business post-condition through `HealingActionOptions`. The runtime records `validated`, `rejected`, `suggested`, or `unverified` outcomes. Only validated AI recoveries enter `.healing/<project>/locator-cache.json`, and cache records carry a semantic-validation marker plus verification description. Legacy cache entries are intentionally ignored.

Reporting consumes the same outcome model: only validated records mark a test `PASSED WITH HEALING`; rejected attempts remain visible in the healing audit and do not inflate release KPIs or `qa:heal` source-maintenance frequency.

## v1.2.3 visibility-aware locator cardinality

The healing resolver now evaluates locator cardinality after applying Playwright visibility filtering. Hidden duplicates (for example a hidden modal template plus the visible control) therefore do not make a valid locator fail strictness. `LocatorDescriptor.match` supports two policies:

- `unique` (default): exactly one visible element is required
- `firstVisible`: explicit project-owned opt-in for semantically equivalent duplicate visible controls

`firstVisible` is not a framework-wide relaxation. Use it only for a known application pattern and keep a business post-condition on critical actions. The SDET Create User entry point uses this policy because multiple equivalent entry controls can be rendered, while the modal-visible post-condition remains the acceptance gate. Reporting behavior is unchanged: only semantically validated recovery is counted as healing.

For copy drift, prefer a semantic accessible-name pattern over enumerating many literal aliases. v1.2.4 supports `namePattern` on role descriptors. Source-controlled deterministic fallbacks are executable in the default `suggest` mode; cache/AI remain governed and require `runtime`. If the selected page does not expose the target action, project navigation should be represented as another guarded LocatorPlan whose post-condition proves that the intended business area became ready.
