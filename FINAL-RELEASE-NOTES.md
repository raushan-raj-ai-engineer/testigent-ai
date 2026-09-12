## v1.3.5 - Final stale-contract regression closure

- Updated dashboard interactive regression to assert the current business-status label `Blocked` instead of legacy `Skipped`.
- Preserved the explicit-new-app resolver contract by asserting resolution before bootstrapping the new project fixture, then generating only after the fixture exists.
- Updated generated-test architecture assertion from the legacy global `enterprise.fixture.js` import to the current project-owned `../../fixtures/test.fixture.js` import.
- No production auth, generator safety, reporting semantics, or runtime project-selection behavior was weakened.

## v1.3.4 - Final framework regression closure

- Restored the `Reset filters` dashboard control expected by the interactive dashboard runtime and its existing JavaScript reset handler.
- Hardened the mail preview contract against quoted-printable soft line folding without weakening the requirement that the public dashboard URL is present in the generated EML.
- Updated requirement-intelligence test fixtures to create the same per-project `fixtures/test.fixture.ts` contract required by production generation safety checks.
- Preserved the v1.3.x automatic-auth lifecycle, single-flight refresh, atomic verified state promotion, lowercase SDET Practice provider fallback, and deterministic clean-checkout release context.
- No dependency version changes.


## v1.3.3 - Clean-checkout release context propagation

- Fixed `validate:final` so `APP=demo` and `ENV=qa` wrap the complete release-validation chain, not only framework health.
- `scenario:doctor` and any later workspace-aware release gate now inherit the same deterministic context.
- Runtime/project commands remain strict and do not silently default to the demo project.
- Updated the static release contract to validate the delegated final-validation step chain.
## v1.3.2 - Release-gate hardening

- Restored reusable JSDoc coverage for all 183 exported framework declarations after the auth lifecycle refactor.
- Made `npm run validate:final` deterministic on a clean checkout by using `framework:health:release` against the bundled `demo/qa` reference project.
- Kept `framework:health` project-aware for normal developer/CI validation; no silent project default was added to runtime configuration.
- Retains the v1.3.1 lowercase `admin@test.com` SDET Practice provider correction and auth-provider regression contract.

# TestigentAI v1.3.1

- Fixed the SDET Practice automatic-auth provider default username casing from `Admin@test.com` to the live application's accepted `admin@test.com`, resolving `AUTH_REFRESH_FAILED: HTTP 401` on clean v1.3.0 installs.
- Added a deterministic project-provider contract test that validates the exact form login request and resulting `sdet_access_token` storage state without depending on the live SUT.
- Preserved `AUTH_USERNAME` / `AUTH_PASSWORD` secret overrides, so private or environment-specific credentials remain external to the framework.

# TestigentAI v1.3.0
## Generic auth lifecycle and pipeline-safe refresh

- Added a project-neutral `AuthManager` and pluggable project auth provider contract.
- Required UI/E2E auth is prepared before Playwright worker fan-out, reducing duplicate logins on one runner.
- Added proactive refresh using known token expiry plus a configurable safety skew.
- Added cross-process single-flight locking so parallel workers/processes do not refresh the same local state simultaneously.
- Refresh candidates are verified in a fresh browser context before atomic promotion; the previous known-good state is preserved on failure.
- Added live `BrowserContext.setStorageState()` application plus explicit localStorage/sessionStorage restore for safe pre-action refresh and mid-run navigation recovery.
- Runtime recovery is intentionally bounded and never blindly retries mutating clicks/submits.
- Added `auth:check` and `auth:prepare`, lifecycle visibility in `qa:doctor`, reusable provider template, SDET Practice API-login example, CI secret mappings and release contracts.
- Removed scale-audit noise for `_agent/seed.spec.ts`, which is authoring/bootstrap infrastructure rather than a business execution lane.

# TestigentAI v1.2.9
## v1.2.9 evidence de-duplication

- A failed business step now renders one primary failure screenshot inline.
- The scenario-level evidence area is renamed **Additional attachments** when step-level failure evidence exists.
- Image evidence already represented at the failed step is not repeated in the additional-attachments area; video, trace, logs and other evidence remain available.
- The reporting runtime contract now fails if the primary failure screenshot is rendered more than once.


- Deep-reviewed business reporting metrics and corrected scope semantics: Selected, Applicable, Executed, Not applicable and Blocked are now explicit.
- Execution coverage is `Executed / Applicable`; optional disabled capabilities (for example DB type `none`) are Not applicable and no longer depress coverage.
- Executed layer coverage excludes skipped/not-applicable tests.
- Known defects remain Quality failed but accepted/non-blocking when explicitly registered; they no longer force `ATTENTION_REQUIRED` by threshold alone.
- Failed/timed-out UI tests now attach a framework failure screenshot through Playwright so visual evidence survives blob/shard merging.
- Business report failed-step expansion renders screenshots inline and retains video/trace/text links when available.
- Business error text strips ANSI terminal formatting.
- CI normal shards exclude `@ai`; dedicated AI/healing lanes own AI scenarios.
- Final CI merge rejects duplicate business scenarios, merges validated healing + AI usage once, and records aggregation provenance.
- CI report history is restored/persisted so trends represent final merged runs, not independent shards.
- Added strict CI bundle validation requiring a materialized screenshot for every failed UI business scenario.
- Added executable merged-report contract covering shard + AI aggregation, duplicate rejection, not-applicable metrics, healing/AI aggregation and dashboard creation.
- Hardened the merge contract against production schema drift and added proof that failed UI screenshot evidence survives shard/AI aggregation and renders inline in the final merged dashboard.
- Corrected Azure Pipeline multi-artifact download patterns so shard and AI/healing bundles are selected by artifact-name path segment before final merge.
- Added `docs/27-CI-MERGED-REPORTING-AND-EVIDENCE.md`.

# TestigentAI v1.2.7

- Fixed a v1.2.6 TypeScript regression in `tests/framework/mail-notification.spec.ts` after the business reporting model added deterministic outcome fields to `ExecutionFacts`.
- Replaced the hand-maintained mail-test `ExecutionFacts` literal with the production `buildExecutionFacts()` pipeline so future reporting-contract additions cannot silently drift the fixture shape.
- Corrected mail semantics: 29 passed + 1 skipped is **100% quality pass rate** and **96.67% execution coverage**; the preview assertions now verify those metrics independently.
- Kept the v1.2.6 business status model and dashboard/reporting behavior unchanged; this is a validation/test-fixture hotfix, not a reporting-semantic redesign.

# TestigentAI v1.2.6

- Deep-reviewed business reporting against the strongest patterns used by Playwright HTML/Trace, Allure history/retries and ReportPortal run analytics/triage.
- Added a deterministic business-outcome model: `PASSED`, `PASSED_WITH_HEALING`, `PASSED_AFTER_RETRY`, `KNOWN_DEFECT`, `FAILED`, `SKIPPED`, `UNEXPECTED_PASS`.
- Known defects now count in **Quality failed** while remaining non-blocking only when explicitly registered and annotated.
- Added explicit **CI-blocking issues**, **Investigate now**, accepted defect debt, unexpected-pass, flaky/retry, slowest-scenario and quality-trend visibility.
- Added `PASSED_WITH_ACCEPTED_RISK` release-gate state for threshold-compliant runs that still carry registered defect debt.
- Added runtime known-defect annotation support to `KnownDefectRegistry`; generic `test.fail()` is not enough to be classified as a registered defect.
- Added terminal business summary so Playwright's native expected-failure count cannot hide the quality-failure meaning.
- Updated interactive dashboard, JSON facts, CSV export, static report/email, email subject/body, executive summary, history and merged reporting to share one outcome model.
- Kept Playwright technical evidence unchanged as the engineering drill-down source.
- Added contract/release guards for known-defect classification, quality-failed counts, CI-blocking semantics and accepted-risk reporting.
- Added executable `reporting:contract` and wired it into `qa:validate`/`validate:final` so analytics plus dashboard/email semantics are runtime-validated, not only statically inspected.
- Corrected custom reporter stdio declaration and added a terminal runner note explaining why Playwright expected failures can appear in its native passed count while TestigentAI still reports them in **Quality failed**.
- Added `docs/26-BUSINESS-REPORTING-STANDARD-2026.md` with the reporting benchmark, metric definitions and governance rules.

# TestigentAI v1.2.5

- Fixed the root cause behind repeated SDET locator failures: invalid/unstable authentication was reaching the page-object/healing layer as a false locator problem.
- `qa:auth` now verifies login twice: once in the interactive capture context and again in a second fresh browser context before promoting the new auth files.
- Added project-configurable auth verification (URL/control/state-key evidence); SDET Practice uses the project-owned `sdet_access_token` key plus visible `Login` rejection.
- Added gitignored sessionStorage companion capture/restore in addition to Playwright cookies/localStorage state, covering applications that keep auth in sessionStorage.
- `qa:doctor` and project preflight now reject missing/empty persisted auth state instead of trusting file existence alone.
- Authenticated `BasePage.navigate()` now raises `AUTH_SESSION_INVALID` before locator healing when the configured auth contract is not satisfied.
- Playwright browser projects receive the selected storage state explicitly, in addition to the common `use` policy, to make auth propagation obvious and regression-resistant.
- Reporting implementation and report artifact paths were intentionally left unchanged; existing validated-healing reporting invariants remain enforced by the release gate.

# TestigentAI v1.2.4

- Reworked locator resilience after repeated SDET Create User failures instead of adding another one-off selector alias.
- Added regex-style accessible-name contracts (`namePattern`) so one role locator can safely cover Create/Add/New User wording changes.
- Clarified healing modes: `off` = primary only; default `suggest` = primary + reviewed deterministic fallbacks; `runtime` = deterministic + validated cache + configured AI.
- Deterministic fallback execution no longer depends on enabling AI/runtime healing.
- Added structural, modal-linked SDET fallbacks (`aria-controls`, Bootstrap/data target, href/onclick/id/test-id relationships) protected by the existing “user modal becomes visible” post-condition.
- Added guarded User Management navigation recovery for layouts where the CRUD area is not the authenticated landing screen.
- Added bounded visible-control diagnostics on unresolved locators so CI evidence shows the actual interactive UI instead of only “Unable to safely resolve locator”.
- Added regression contracts for semantic role patterns, deterministic fallback execution in suggest mode and failure diagnostics.
- Reporting semantics remain fail-closed: only post-condition-validated recovery is `PASSED WITH HEALING`; rejected/suggested/unverified attempts remain evidence only.

# TestigentAI v1.2.3

- Fixed visibility/cardinality handling in locator healing: hidden duplicate DOM nodes no longer make a valid visible control look ambiguous.
- Added explicit locator match policy (`unique` by default, project-owned `firstVisible` only for semantically equivalent duplicate controls).
- Kept healing fail-closed by default; ambiguous visible locators remain rejected unless the project opts into `firstVisible`.
- Hardened the SDET Create User plan with visible-equivalent role/link/text aliases while retaining the modal post-condition as the business safety gate.
- Added regression coverage for hidden duplicates, explicit duplicate-visible handling, and default ambiguity rejection.
- Corrected older cache-priority contract fixtures so they represent semantically validated cache entries under the v1.2.2+ trust model.
- Reporting semantics remain unchanged: only semantically validated recoveries count as `PASSED WITH HEALING`; rejected/suggested/unverified attempts remain audit evidence.

# TestigentAI v1.2.2

- Replaced the stale SDET Create User CSS primary with a user-facing role/name locator and label-first form locators.
- Added semantic post-condition validation to guarded healing actions. Locator visibility/uniqueness and a successful click are no longer sufficient to claim healing success.
- Added healing outcomes (`validated`, `rejected`, `suggested`, `unverified`); only validated recoveries count as self-healed.
- AI recovery is cached only after semantic validation; rejected AI/cache candidates are never promoted and rejected cache hits are evicted.
- Legacy pre-v1.2.2 healing cache entries are intentionally ignored to prevent reuse of previously unverified locator guesses.
- Added contract coverage proving wrong-candidate rejection, semantic AI-cache promotion, cache reuse without another AI call, and rejected-AI no-cache behavior.
- Hardened business reporting/merge/executive summary so rejected/suggested/unverified healing evidence remains visible without inflating Self-healed KPIs or source-healing maintenance candidates.
- Updated healing, reporting, authoring and release-validation documentation.

# TestigentAI v1.2.1

- Added centralized database capability resolution (`required`, `type`, `enabled`, missing secret configuration) to RuntimeConfig.
- Optional unavailable database capability now skips `@db` tests at the reusable fixture layer instead of failing the entire selected project.
- Required unavailable database capability fails early in `qa:doctor`, framework health and project preflight.
- Database type is configurable per project/environment with optional `DB_TYPE` runtime override; connection secrets remain external.
- Removed project-spec `process.env.DB_TYPE` skip logic; database gating is framework-owned.
- Added database capability visibility to `qa:status`, `qa:doctor`, framework health and project preflight output.
- Updated templates, contract tests and operational documentation to require `@db` tagging for database-dependent scenarios.

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

## 2026-09-11 — Test authoring architecture simplification

- Added centralized workspace/runtime configuration with no silent `demo/qa` runtime fallback.
- Added facade-first project template and project-specific Playwright agent seed tests.
- Added thin `qa:*` onboarding/development commands.
- Strengthened architecture enforcement for raw UI actions, framework-service construction, URLs and credential literals in ordinary specs.
- Added configurable architecture exceptions with reasons.
- Added review-only healing maintenance candidates and source-healing policy.
- Hardened Playwright agent policy (V2) around project fixtures/facades, seed tests and assertion safety.
- Updated onboarding, architecture, daily commands, project handoff, agents, healing and release-validation documentation.
- See `docs/25-AUTHORING-ARCHITECTURE-REFACTOR.md` for implementation and validation detail.
