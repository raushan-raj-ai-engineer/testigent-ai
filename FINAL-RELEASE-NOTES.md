# Final Enterprise Release Notes

This release converts the repository from an application-centric layout into a reusable multi-project quality platform.

Key changes: reusable engines moved under `src/framework`; project code/data/config/tests moved under `projects/<project>`; generic project creation/preflight/test runner added; project-scoped reports/results/history/healing added; auth state is project-configured and preflighted; requirement generation/review targets project-owned paths; application defects use project known-defect registry; obsolete generated snapshots/backups/duplicate documentation were removed; current architecture/daily-use/onboarding/security/CI docs replace historical phase documents.

The SDET Practice Delete behavior remains an open AUT defect (`SDET-DEL-001`) and is intentionally not “fixed” in automation.

## Healing chain hardening

Healing priority is enforced as: primary locator -> declared deterministic fallbacks -> validated project-scoped cache -> explicitly configured AI provider(s) -> deterministic safety validation -> runtime/suggest policy -> cache validated runtime result. No AI vendor is implicitly selected.

Provider selection is user/CI controlled: `AI_PROVIDER_MODE=single` uses exactly `AI_PROVIDER`; `AI_PROVIDER_MODE=failover` uses exactly `AI_PROVIDER_ORDER`. Every selected/listed provider must be fully configured or the framework fails fast with a configuration error. Failover continues only on provider/runtime error or no-result. A concrete AI proposal is returned to the HealingOrchestrator for deterministic validation; unsafe proposals are rejected rather than voted across providers. Stale cached locators are evicted automatically.

## Dashboard asset path hardening

- Dashboard client asset is resolved relative to the reporting module via CommonJS-safe `__dirname`, not the process working directory.
- The static release gate rejects legacy `src/reporting/` path references to prevent restructure regressions.


## Provider-neutral AI configuration

- AI remains disabled by default.
- Ollama is supported for local/offline-friendly execution but is not mandatory or silently injected.
- Gemini, OpenAI, Azure OpenAI, Anthropic, approved compatible endpoints and custom HTTP gateways can be selected explicitly.
- CI can use the same single/failover model with credentials injected from the CI secret store.
- `npm run test:ai-healing` is provider-neutral; convenience scripts exist for Ollama and Gemini.
- Demo Todo navigation is pinned to `/todomvc/` so the reference UI test opens the actual TodoMVC application rather than the site root.


## Deep Review: AI observability, onboarding and agent productivity

- Added runtime AI audit with actual provider/model/status/latency and no prompt/key persistence.
- Added AI runtime evidence to dashboard, executive summary and email summary.
- Added provider/model terminal logging controlled by `AI_RUNTIME_LOGGING`.
- Added generic `agents:init` driven by `PLAYWRIGHT_AGENT_LOOP`.
- Removed pre-generated `.claude`, `.codex`, `.opencode`, `opencode.json` and empty `.playwright` release clutter; selected loops are generated on demand.
- Added measured authoring-productivity sessions and baseline-backed savings reporting.
- Added root-folder/local-state, new-project handoff and Playwright Agent productivity guides.
