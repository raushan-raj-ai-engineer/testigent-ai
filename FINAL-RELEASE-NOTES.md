# TestigentAI v1.2.0

- Added schema-driven declarative/low-code UI authoring with explicit YAML-vs-TypeScript guidance.
- Added `scenario:help`, `scenario:list`, `scenario:new`, `scenario:validate`, `scenario:run`, `scenario:schema`, and `scenario:doctor` commands.
- Added Draft 2020-12 JSON Schema, VS Code YAML autocomplete/hover/validation association, and recommended editor extensions.
- Added recursive per-project scenario discovery; every YAML scenario is now an independent Playwright test with `@scenario:<id>` selection, annotations, sharding, retries, and step-level reporting.
- Added app-root-aware declarative navigation and safe-by-default cross-origin blocking.
- Expanded constrained actions/locators while keeping arbitrary JavaScript/shell execution out of YAML.
- Added declarative authoring contract tests and release-gate enforcement.
- Hardened working-tree release verification so Git-ignored local `.env`/`.DS_Store` files do not create false release failures, while clean ZIPs remain strict because they contain no `.git` ignore context.
- Incorporated the PR profile/console reporter/accessibility CI hardening and TodoMVC routing fix discovered during v1.1.2 PR verification.
- Added deep research and operational user guide documents.

# Final Enterprise Release Notes

## v1.1.2 CLI/audit usability hotfix

- Added `comments:audit` as a compatibility alias for `docs:comment-audit`, so both intuitive and canonical command names work.
- Removed the misleading scale warning for pure data-contract specs: tests explicitly classified with `@data` no longer require a fake UI/API/DB/E2E lane tag.
- The release static gate now enforces the comment-audit alias so this CLI contract cannot regress silently.

## v1.1.1 verification hotfix

- Fixed a TypeScript compile defect in `scripts/test-project.ts` where an optional function parameter type was indexed through `Parameters<...>[0]`, producing `TS2339` because the parameter can be `undefined`.
- `ProjectPreflight.profile` and the runner helper now use the explicit reusable `ExecutionProfileName` contract. The unsafe cast was removed.
- This defect was found by the clean `VERIFY_RELEASE.sh` flow after dependency installation, demonstrating why `typecheck` remains a mandatory release gate.

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

## V6 — Market-informed scale and quality architecture

- Added execution profiles (`pr`, `smoke`, `regression`, `nightly`, `release`, `custom`) and layered organization/project/environment/runtime policy resolution.
- Added percentage worker support (`PW_WORKERS=50%`), Playwright-native lanes/sharding, optional duration-aware balancing and indexed duration history.
- Removed DB/API-only dependence on browser authentication preflight.
- Added parallel-safe `dataScope`, duplicate `caseId` protection, declaration-time JSON/CSV/YAML/Excel case loading, and a one-row-per-test reference.
- Added visual/accessibility/performance quality lanes with explicit scope boundaries.
- Added governed JSON/YAML declarative scenarios with allowlisted actions only.
- Added a provider-neutral AI/agent evaluation contract with deterministic hard-gate metrics and bounded concurrency; DeepEval/LangSmith can be integrated through adapters rather than becoming core dependencies.
- Pinned package dependency versions to the committed lockfile for deterministic installation.
- Added scale and reusable-API documentation audits plus market/benchmark guidance.
- Added current 2026 competitive research. Commercial device clouds, full WCAG engines, SAP/desktop drivers and load generators are treated as integration targets rather than falsely claimed built-in infrastructure.

## Final deep-review hardening

- Closed Playwright CLI filter-precedence gap: user grep/invert flags are merged with, rather than replace, mandatory profile/lane governance.
- Hardened parallel data ownership with environment + unique Playwright test identity and declaration-time `caseId` annotations.
- Added invalid-duration guards for history-based scheduling metadata.
- Added dependency-independent release/secret/reproducibility verification and a clean-install `VERIFY_RELEASE.sh` gate.
- Added lockfile-derived CycloneDX SBOM generation and release supply-chain inventory.
- Market positioning remains benchmark-led: TestigentAI is the provider-neutral quality control plane; dedicated real-device, specialist accessibility and load infrastructure remain pluggable providers rather than fake built-ins.
