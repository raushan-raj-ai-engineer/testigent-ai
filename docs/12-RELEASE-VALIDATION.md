# Release Validation

## One-command release gate

Run from repository root after a clean install:

```bash
npm ci
npx playwright install chromium
npm run validate:final
```

`validate:final` runs the complete release chain inside a deterministic `APP=demo`, `ENV=qa` context:

1. `release:static` — stale paths, unresolved internal imports, JSON validity and project contract checks.
2. `architecture:check` — reusable-core isolation, sibling-project isolation and backup-artifact checks.
3. `framework:health` — health check of the bundled reference project.
4. `scale:audit` — execution-profile, lane and scale-governance validation.
5. `scenario:doctor` — declarative schema/capability/editor-integration drift check.
6. `docs:comment-audit` — reusable-export JSDoc contract.
7. `reporting:contract` — business-reporting and merged-report contracts.
8. `typecheck` — TypeScript compile validation.
9. `test:framework:critical` — framework regression suite.
10. `security:check` — HIGH/CRITICAL npm audit policy.

The release context belongs only to this certification runner. Normal project-aware commands remain strict and still require an explicit project/environment selection.

The only explicit security exception is the vendored `xlsx@0.20.3` package. The exception is version-locked and documented in `docs/SOURCES.md`; any other HIGH/CRITICAL finding blocks the release.

## Project validation

For a project that does not require authentication:

```bash
APP=demo ENV=qa npm run validate:project
```

For an authenticated project with lifecycle auto-refresh, prefer the non-interactive readiness flow:

```bash
APP=sdet-practice ENV=qa npm run auth:check
APP=sdet-practice ENV=qa npm run auth:prepare
APP=sdet-practice ENV=qa npm run validate:project
```

`test:project` also prepares required UI/E2E auth automatically before Playwright workers start. MFA/manual-only projects can still use `APPLICATION_EXPLORATION_ENABLED=true npm run app:auth`. The generic project runner resolves the project test directory and configured storage-state path automatically.

## Known application defects

Project defects are not patched out of automation. `projects/sdet-practice/known-defects.json` currently records the observed Delete defect. The expected-failure marker is activated only immediately before the affected Delete step so earlier Create/Update regressions remain real failures. When the product defect is fixed, Playwright will report an unexpected pass until the known-defect entry is resolved/removed.

## Static release evidence for this archive

Before packaging this release, the deep-review gate must confirm:

- release static gate passes with no stale paths or unresolved internal imports;
- all TypeScript files pass the CommonJS syntax/transpile parser check;
- YAML and JSON parse cleanly;
- AI runtime audit smoke test records provider/model and does not persist request evidence;
- authoring-productivity start/complete/report smoke test works;
- repository agent definitions contain the enterprise overlay and do not pin a coding-agent model;
- package lock remains unchanged unless a dependency change is intentional;
- generated runtime/auth/report/cache folders and optional pre-generated coding-agent trees are cleaned from the release archive.

A clean dependency install and runtime Playwright regression should always be executed on the target development/CI environment using `npm run validate:final` because browser binaries, registry access and remote AUT availability are environment-dependent. The final release gate deliberately wraps the complete validation chain in the bundled `demo/qa` release context, so workspace-aware gates such as framework health and scenario doctor are deterministic on a clean checkout and do not require a saved workspace or APP/ENV. Normal runtime commands remain strict; validate each real application separately with `APP=<project> ENV=<env> npm run validate:project`.

## AI configuration validation

AI is disabled by default and no vendor is silently selected. Before an AI-enabled run, validate the exact environment configuration:

```bash
npm run ai:check
```

Single Gemini example:

```env
AI_ENABLED=true
AI_PROVIDER_MODE=single
AI_PROVIDER=gemini
AI_ALLOW_CLOUD_EGRESS=true
GEMINI_API_KEY=<secret>
GEMINI_MODEL=gemini-3.8-flash
```

Then:

```bash
npm run ai:check
npm run test:ai-healing
```

For Gemini, `ai:check` performs a real Models API lookup. `test:ai-healing` fails rather than silently skipping if the AI demo was explicitly requested but no provider resolves.

Failover must be explicit:

```env
AI_PROVIDER_MODE=failover
AI_PROVIDER_ORDER=gemini,openai
```

The framework does not insert Ollama or another provider automatically. If AI is enabled but the selected/listed provider configuration is incomplete, the run fails fast instead of silently disabling or skipping that provider.

## Release cleanup

Before packaging, run:

```bash
npm run clean:all
```

The archive must not contain `node_modules`, reports, test-results, Playwright reports, auth state, runtime state, healing cache, report history, application knowledge, proposal backups, `.DS_Store`, logs, or backup files. Core integration files are retained (`.github`, `.vscode`, `.mcp.json`, `.mcp`, `agent-prompts`). Tool-specific `.claude`, `.codex`, `.opencode` trees are not shipped; `npm run agents:init` generates and enterprise-hardens only the loop selected by the team.


## Authoring architecture gate

Before a PR/release, select the target explicitly (CI uses `APP`/`ENV`; local users use `qa:use`) and run `npm run qa:validate`. `architecture:check` enforces project fixture/facade usage in ordinary specs, rejects raw UI actions/direct framework-service construction, and checks project seed/facade contract files. Review archives must exclude `.auth/`, `.env`, `.runtime/`, `.healing/`, reports, test-results, browser reports, `node_modules`, coverage/build output and local caches.


## Database capability policy

Database use is project/environment configurable and is enforced by the reusable framework. `projects/<project>/project.json` declares whether database validation is required; `projects/<project>/config/<env>.json` selects the database type (`none`, `postgres`, `mysql`, or `mssql`). `DB_TYPE` may override the configured type in CI/local runtime, while database credentials remain secret environment variables.

- optional + unavailable: tests tagged `@db` are skipped automatically with a clear reason; UI/API suites continue
- configured and ready: `@db` tests execute normally
- required + unavailable: `qa:doctor`, framework health and project preflight fail before Playwright execution

Business specs must not read `DB_TYPE` or manually decide whether to skip. Tag any scenario that requires database access with `@db`; the framework owns capability gating.

## v1.2.2 healing/report regression gate

Before merge, verify both normal execution and the semantic healing contract:

```bash
npm run typecheck
npm run test:authoring:contract
npm run test:dashboard
npm run qa:validate -- --with-tests
```

The healing contract must prove that a wrong actionable locator is rejected, rejected AI output is not cached, a validated AI recovery is cached with semantic-validation metadata, and the next equivalent run can reuse that cache without another AI call. Business reporting must count only validated recoveries as self-healed while still displaying rejected/suggested/unverified audit evidence.

## v1.3.x auth lifecycle gate

The release must include `tests/framework/auth-lifecycle.spec.ts` plus `tests/framework/sdet-auth-provider.contract.spec.ts`, and the static gate must enforce the reusable manager/provider/lock contracts. The regression suite covers missing-state refresh, concurrent single-flight refresh, hot navigation recovery, pre-action near-expiry refresh, and JWT-expiry planning. Auth provider output must be verified in a fresh browser context before atomic promotion, and browser/session state must remain gitignored.

```bash
APP=demo ENV=qa npm run test:framework:critical
APP=sdet-practice ENV=qa npm run auth:check
```

See `docs/28-AUTH-LIFECYCLE-AUTO-REFRESH.md`.
