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
9. `test:review:hardening` — browser-free architect-review regression gate for redaction, egress, run/cache isolation, HTTP AI reliability and advisory exceptions.
10. `test:framework:critical` — full framework regression suite, including delayed-primary healing behavior.
11. `security:check` — HIGH/CRITICAL npm audit policy with advisory-scoped exception governance.

The release context belongs only to this certification runner. Normal project-aware commands remain strict and still require an explicit project/environment selection.

Security exceptions are defined in `config/security-exceptions.json` and must name the exact package, advisory ID, affected range, rationale, owner and expiry. There is no package/version-wide allowlist. A new advisory for an already-excepted package/version blocks the gate until that exact advisory is independently reviewed and approved.

## v1.5.0 architect-review hardening gate

The following contracts are release-blocking and map directly to the independent v1.4.2 review:

- **Sensitive evidence:** JSON bodies are recursively redacted before truncation; URL userinfo/query secrets and free-text credentials/PII are sanitized; AI payloads use explicit allowlists. Visual evidence defaults to `EVIDENCE_VISUAL_POLICY=masked`; unmasked trace/video/screenshot capture requires explicit opt-in.
- **AI destination policy:** all adapters validate resolved destination origin and transport before network activity and on redirects. Loopback is allowed by default; private/custom/external origins require explicit policy. Provider labels never imply locality.
- **Browser-free lanes:** API/data/DB fixture use must not request `browser` or `context`; session-storage restoration is attached only to the UI context fixture.
- **Run isolation:** reports/results/logs/audits are scoped by `<APP>/<ENV>/<RUN_ID>` and `.runtime/latest-run` is non-authoritative convenience state only.
- **Healing cache:** entries include application, environment, locator-plan revision and expiry; writes are lock-protected and atomically published; malformed/legacy cache is rejected with diagnostics.
- **Locator readiness:** primary locators receive a bounded readiness window before fallback/cache/AI recovery. Ambiguous visible matches still fail closed.
- **HTTP AI reliability:** generic HTTP uses the shared egress/redirect/timeout layer, schema validation and categorized errors; it does not silently retry outside usage accounting.
- **Security advisories:** exceptions are exact-advisory, owned and expiring; same-package future advisories remain blocking.

Run the focused gate independently with:

```bash
APP=demo ENV=qa npm run test:review:hardening
```

The full `validate:final` chain includes it automatically.

### Evidence retention and screenshots

Default `masked` mode disables Playwright automatic trace/video/screenshots because those artifacts cannot reliably apply the framework's configured sensitive-region masks. Framework-managed failure screenshots use `EVIDENCE_MASK_SELECTORS`. Local run artifacts default to a 14-day lifecycle via `EVIDENCE_RETENTION_DAYS`; set `0` only when another approved retention mechanism owns cleanup. CI artifact retention remains configured in the CI platform. Use `EVIDENCE_VISUAL_POLICY=standard` only together with `EVIDENCE_ALLOW_UNMASKED_VISUALS=true` when the project has an approved capture/retention policy. `off` disables framework visual capture.

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
AI_ALLOWED_EXTERNAL_ORIGINS=https://generativelanguage.googleapis.com
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

Database use is project/environment configurable and is enforced by the reusable framework. `projects/<project>/project.json` declares whether database validation is required; `projects/<project>/config/<env>.json` exclusively selects the database type (`none`, `postgres`, `mysql`, or `mssql`). Repository or machine-level `DB_TYPE` values do not override another project's capability; only DB connection secrets such as `DB_HOST`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` come from the environment.

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
## v1.5.1 runtime collaborator-contract gate

v1.5.1 adds browser-backed regressions proving locator-readiness diagnostics remain non-blocking when an injected logger omits `debug()` or when the debug sink throws. It also verifies that `.runtime/latest-run` is not an implicit generic write identity and that a current `RUN_ID` wins over the convenience pointer. See `docs/36-v1.5.1-RUNTIME-CONTRACT-CLOSURE.md` and `docs/37-v1.5.1-DEEP-REVIEW-VALIDATION.md`.

