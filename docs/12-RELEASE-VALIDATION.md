# Release Validation

## One-command release gate

Run from repository root after a clean install:

```bash
npm ci
npx playwright install chromium
npm run validate:final
```

`validate:final` runs, in order:

1. `release:static` — stale paths, unresolved internal imports, JSON validity and project contract checks.
2. `architecture:check` — reusable-core isolation, sibling-project isolation and backup-artifact checks.
3. `framework:health` — selected environment/project configuration health.
4. `typecheck` — TypeScript compile validation.
5. `test:framework:critical` — framework regression suite.
6. `security:check` — HIGH/CRITICAL npm audit policy.

The only explicit security exception is the vendored `xlsx@0.20.3` package. The exception is version-locked and documented in `docs/SOURCES.md`; any other HIGH/CRITICAL finding blocks the release.

## Project validation

For a project that does not require authentication:

```bash
APP=demo ENV=qa npm run validate:project
```

For an authenticated project, capture state once when needed:

```bash
APP=sdet-practice ENV=qa APPLICATION_EXPLORATION_ENABLED=true npm run app:auth
APP=sdet-practice ENV=qa npm run validate:project
```

The generic project runner resolves the project test directory and configured storage-state path automatically.

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

A clean dependency install and runtime Playwright regression should always be executed on the target development/CI environment using `npm run validate:final` because browser binaries, registry access and remote AUT availability are environment-dependent.

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
