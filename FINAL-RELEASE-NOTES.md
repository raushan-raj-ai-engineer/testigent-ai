# TestigentAI v1.9.0 — Failure Intelligence & Customer Showcase Candidate

## Certified baseline

`v1.8.0` is the immutable certified baseline at commit `1ad48d67661df02f51e5b6268a3f0d74bf2a182d`. PR/main full reruns plus main and tag-triggered Release Compatibility passed the full 5/5 Ubuntu/macOS/Windows browser matrix. Post-release documentation main `6090b702a56078a546cfe6dd0d2bc2cbaba92dd6` also passed CI without moving the v1.8.0 tag.

## Consolidated v1.9.0 scope

- deterministic Failure Intelligence with explicit root-cause taxonomy;
- stable normalized incident fingerprints and common-cause clustering;
- fail-honest `UNKNOWN` when evidence is insufficient;
- live-only immutable failure-history trust boundary;
- read-only MCP failure explanation and multi-failure triage;
- 10 realistic customer-showcase scenarios with hard synthetic/non-claimable metadata;
- one-click showcase of Failure, Adoption, Benchmark, Scale, API Contract, Healing and Agentic/MCP signals;
- live dashboard links to Failure Intelligence and the separately labeled showcase;
- npm Bulk Advisory security fallback carried forward for legacy quick-audit endpoint retirement;
- reporting-surface freeze contract after v1.9 certification.

This package is a **development candidate**, not a certified v1.9.0 release. The showcase exists to explain the product before a customer has accumulated real evidence; its values can never become customer/adoption/differentiation/scale/release claims.

See `docs/60-v1.9.0-FAILURE-INTELLIGENCE.md` through `docs/64-v1.9.0-CANDIDATE-HANDOFF.md`.

---

# TestigentAI v1.8.0 — Evidence-Backed Product Intelligence (Certified Historical Release)

## Certified release

TestigentAI v1.8.0 is the immutable certified release at commit:

`1ad48d67661df02f51e5b6268a3f0d74bf2a182d`

Certification evidence completed successfully:

- PR CI and full rerun passed (`34784647923`, attempt 2).
- Main CI and full rerun passed (`34800608332`, attempt 2).
- Fresh main Release Compatibility passed 5/5 (`34801102017`).
- Annotated tag `v1.8.0` resolves to the exact certified commit.
- Tag-triggered Release Compatibility passed 5/5 on the same commit (`34801403186`).
- Post-release documentation sync passed main CI (`34802423931`) and did not move the release tag.

## v1.8.0 scope

- Adoption & Pilot Intelligence across representative applications and opaque engineer aliases.
- Measured authoring, migration, triage, CI/cost and quality metrics with explicit truth boundaries.
- Provenance-bound comparative benchmarks against explicit baselines such as plain Playwright.
- Seeded false-heal measurement separated from valid recovery.
- Deterministic 100/500/2,000-case scale planning and measured scale-evidence evaluation.
- OpenAPI 3 response contract validation and conservative breaking-change detection.
- Adoption, benchmark and API-contract dashboard drill-down pages.
- Blocking Product Intelligence deterministic safety in GitHub Actions, Azure Pipelines, `validate:final` and Release Compatibility.
- Security audit hardened with a fail-closed npm Bulk Advisory fallback after the legacy quick-audit endpoint stopped producing usable evidence.

Real adoption, differentiation, scale and productivity claims remain evidence-bound; synthetic examples and planning diagnostics remain non-certifying.

---
# TestigentAI v1.7.0 — Agentic Test Intelligence (Certified Historical Release)

## Certified baseline

`v1.6.1` was the certified baseline at v1.7.0 candidate creation. v1.7.0 subsequently certified at immutable commit `d9a228bc826e2bfaf4036535b61593ca25dad4b4` after main CI/rerun plus main and tag-triggered Release Compatibility 5/5.

## v1.7.0 candidate scope

- deterministic planner and change-impact intelligence built on the existing requirement engine;
- proposal-only generation with project/path/size/duplicate safeguards;
- deterministic generated-source reviewer for secrets, raw Playwright bypasses, direct infrastructure access and traceability gaps;
- trust policy where only `ACCEPTED` evidence may be promoted and required human approval cannot be bypassed by model confidence;
- immutable, sanitized run-scoped agent decision ledger;
- governed TestigentAI MCP stdio server with planning/impact/discovery/review/evidence tools and no source-promotion or arbitrary-execution tools;
- one-click `agentic-intelligence.html` dashboard drill-down while deterministic release facts remain authoritative;
- blocking Agentic Deterministic Safety jobs in GitHub Actions and Azure Pipelines;
- certified v1.6.1 canary fixes carried forward: GitHub outcome normalization plus runtime canary paths.

Historical pre-certification note: those connected validation, PR/main/rerun and 5/5 compatibility gates subsequently passed; `v1.7.0` is now the immutable certified baseline for this v1.8.0 candidate.

See `docs/50-v1.7.0-AGENTIC-TEST-INTELLIGENCE.md` through `docs/53-v1.7.0-DEEP-REVIEW-VALIDATION.md`.

---

# TestigentAI v1.6.1 — AI Operational Reliability (Historical Candidate Record)

## Historical baseline at candidate creation

`v1.6.0` is the immutable certified baseline at commit `4225e151fadcc85fd0a9861b385bda82bd1c96c0`. Tag-triggered Release Compatibility run `34760349497` passed the full 5/5 Ubuntu/macOS/Windows browser matrix.

## v1.6.1 scope

- blocking `AI Deterministic Safety` job with no external provider dependency;
- non-blocking `AI Live Provider Canary` for real provider/generation/healing availability;
- structured `HEALTHY` / `DEGRADED` / `MISCONFIGURED` / `SKIPPED` canary evidence;
- environment-scoped, lock-protected AI provider-health history;
- one-click `ai-provider-health.html` drill-down from the compact business dashboard;
- healthy live AI evidence is merged only when the canary is healthy; provider degradation never rewrites deterministic release facts.
- merge-time AI evidence selection is artifact-driven and rerun-safe: newest same-workflow canary wins, missing expected evidence fails closed, and intentional skips record `SKIPPED`.

See `docs/48-v1.6.1-AI-OPERATIONAL-RELIABILITY.md`. This section preserves the pre-certification candidate state; those PR/main/rerun and compatibility gates later passed and v1.6.1 is now the immutable certified baseline.

---

# TestigentAI v1.6.0 — Review Candidate

### Connected type-safety correction

- A connected `validate:final` attempt reached `tsc --noEmit` and exposed `TS18048` in the new evidence-intelligence contract test because the test mutated optional `ExecutionFacts.aiUsage` without first narrowing it.
- The regression test now explicitly asserts that `buildExecutionFacts()` materializes AI usage before adding its synthetic record. The public/backward-compatible optional report type remains unchanged.
- All earlier connected gates in that run (static, architecture, health, scale, scenario, documentation and reporting contracts) passed before the compiler stopped on this test-only issue.

### Deep-review closure before packaging

- Zero-scenario reports now fail honest: `INSUFFICIENT EVIDENCE`, `UNKNOWN` release risk and `N/A` rates instead of a misleading green signal.
- Final CI bundle validation requires the Evidence Ledger/Graph, matching run identity, truth boundary and core claim provenance.
- Evidence-graph edges are referentially valid and direct attachment links reject unsafe absolute/parent-traversal paths.
- Evidence graph and change-impact analysis were optimized to avoid avoidable quadratic/repeated-file-read behavior.
- Change-impact ownership hints now ignore generic/short filename vocabulary so heuristic noise cannot masquerade as narrow impact evidence; unresolved project changes fail safe to the full project suite.
- Historical pre-certification note: connected Node 22 `npm ci && npm run validate:final` plus the supported OS/browser matrix were the certification boundary; those gates later passed and v1.6.0 is now the certified baseline.

# TestigentAI v1.6.0 — Evidence Intelligence Review Candidate

Historical status: **REVIEW CANDIDATE**. At that point v1.5.3 remained the last certified tag; v1.6.0 later completed connected certification and is now the immutable certified baseline.

## v1.6.0 product improvements

- deterministic Quality Evidence Graph behind stakeholder claims
- one-click Evidence Ledger from the existing business dashboard
- explainable score-free LOW/MEDIUM/HIGH release risk with named factors
- advisory change-impact analysis with transitive dependency reasons and fail-safe shared-core behavior
- run-scoped incremental Playwright migration slices
- seeded false-heal safety benchmark included in architect-review hardening
- reporting contract/static release gates that prevent evidence/provenance features from silently disappearing
- documentation updated in parallel (`docs/42` through `docs/45`)

## Claim discipline

The candidate does not claim measured customer adoption, maintenance savings, universal zero false-heal rate or product-market fit. Those remain pilot/benchmark outcomes.

---

# TestigentAI v1.5.3 — Windows static-gate portability hardening

**Certified release status:** main CI run `34744306756` passed all core, AI and merged-report jobs; tag-triggered Release Compatibility run `34744507321` passed the full 5/5 Ubuntu/macOS/Windows browser matrix. Current operational summary: `docs/41-CURRENT-RELEASE-STATUS.md`. Git/GitHub CLI operations: `docs/40-GIT-GITHUB-CLI-TERMINAL-GUIDE.md`.

- Fixed a Windows-only false failure in `release:static` caused by LF-only multi-line workflow matching against CRLF checkout content.
- Structural workflow/pipeline checks now normalize line endings before applying release policy.
- The merged-report summary policy remains unchanged: dedicated summary script, `shell: bash`, and `continue-on-error: true`.
- Added an executable LF/CRLF portability regression and made it part of `npm run release:static`.
- Added release documentation for the Windows compatibility incident and acceptance criteria.
- Retains all v1.5.2 CI rerun artifact-provenance hardening and v1.5.1/v1.5.0 reliability/security controls.

# TestigentAI v1.5.2 — CI rerun artifact provenance hardening

- Fixed GitHub Actions rerun provenance so every technical, business and AI artifact name includes the immutable `RUN_ID` (`github.run_id-github.run_attempt`). A rerun can no longer ambiguously download artifacts created by another attempt of the same workflow run.
- Scoped merge download patterns to the current `RUN_ID`, keeping attempt 1 and attempt 2 artifacts logically separate even though GitHub associates them with the same workflow run.
- Business artifact uploads now fail when the marker/report directory is unexpectedly absent instead of allowing a later merge stage to discover an empty bundle.
- Added a pre-merge downloaded-bundle diagnostic that lists files and counts `ci-bundle.json` markers before technical/business aggregation.
- The merge stage now expects an AI business lane only when the AI job actually succeeded; an AI configuration/provider failure remains the primary CI failure instead of causing a misleading secondary missing-AI-report error.
- Intermediate-artifact cleanup is restricted to the current attempt's artifact names so cleanup from one attempt cannot delete another attempt's evidence.
- Final report artifact names include `RUN_ID`, making rerun outputs independently identifiable.
- Added a static release contract that blocks future removal of attempt-scoped artifact names/download patterns and the AI-success merge condition.
- Upgraded report-history caching from `actions/cache@v4` to `actions/cache@v6`, removing the Node 20 action-runtime deprecation warning on current GitHub-hosted runners.
- Release Compatibility remains manually dispatchable and now also runs automatically on `v*` release tags.
- Retains all v1.5.1 runtime-collaborator fixes and v1.5.0 A1–A8 architect-review hardening.

# TestigentAI v1.5.1 — Runtime contract closure after architect hardening

- Fixed a runtime contract regression in `HealingOrchestrator.usableLocator()` where best-effort readiness diagnostics assumed every injected logger implemented `debug()`. Lightweight test/consumer loggers with only `warn()` could throw `TypeError: this.logger.debug is not a function` and stop deterministic healing.
- Narrowed the healing logger dependency to the methods actually required: `warn()` is mandatory; `debug()` is optional and best-effort. Diagnostic logging failures can no longer alter locator-recovery control flow.
- Narrowed the healing AI dependency to `proposeLocator()` instead of the concrete `AiGateway` class, so test doubles and alternate governed gateways are structurally type-checked without unsafe casts.
- Narrowed `BaseApiClient` logging to the `info()` contract it actually uses.
- Removed the mutable latest-run pointer from generic `ProjectPaths` write-path resolution. Latest-run lookup is now explicit through user-facing `latest*` helpers, preventing a new process without `RUN_ID` from silently writing into a previous execution.
- Removed committed credential-shaped fallbacks from the SDET Practice sample provider. Authenticated sample execution now requires `AUTH_USERNAME` and `AUTH_PASSWORD` from local/protected CI secret configuration; its provider contract uses synthetic values only.
- Removed unsafe logger `as any` casts from healing/review hardening tests and added an explicit regression proving readiness misses work with a logger that has no `debug()` method. Future logger-contract drift now surfaces at compile/test time rather than browser runtime.
- Retains all v1.5.0 A1–A8 architect-review hardening, reporting/run isolation, egress, evidence, cache, CI and security controls.

# TestigentAI v1.5.0 — Independent architect-review hardening and adoption readiness

- Closed review findings A1–A8 at their root boundaries: shared sensitive-data sanitization, destination-based AI egress, browser-free API/data/DB fixtures, immutable run isolation, concurrent environment-scoped healing cache, bounded primary-locator readiness, reliable generic HTTP AI handling, and advisory-scoped security exceptions.
- Added secure visual-evidence governance. Default `masked` mode disables automatic trace/video/screenshots that cannot reliably apply sensitive-region masks; framework-managed failure screenshots can mask configured selectors. Unmasked capture requires explicit approval.
- Hardened AI redirects: every redirect is policy-checked; cross-origin redirects are blocked by default, and explicit opt-in strips authorization/cookie/API-key headers before following.
- Removed implicit trust for official cloud-provider origins. Every external AI destination now requires both `AI_ALLOW_CLOUD_EGRESS=true` and an exact `AI_ALLOWED_EXTERNAL_ORIGINS` entry.
- Sanitizes provider-returned healing reasons before they can reach cache, logs or reports, closing the outbound-only redaction blind spot.
- Scoped reports/results/logs/AI audit/healing audit by `<APP>/<ENV>/<RUN_ID>` with a non-authoritative latest-run pointer; CI upload/merge/finalization paths now preserve the same identity.
- Business report merge now fails closed on mixed application/environment/run identity, and multi-project portfolio execution propagates one immutable portfolio run ID.
- Hardened `.report-history` as shared mutable state using application/environment scope plus lock/atomic merge behavior for business trends and duration planning.
- Healing cache invalid-entry pruning re-checks under the write lock so a stale reader cannot delete a newer valid concurrent write. Explicit `REPORT_HISTORY_FILE` overrides remain supported for existing consumers.
- Added a Node 22 release-compatibility workflow across Linux Chromium/Firefox/WebKit, macOS WebKit and Windows Chromium. It records exact Node/Playwright/browser versions rather than treating source checks as compatibility evidence.
- Added `test:review:hardening` to `validate:final`, including canary redaction, egress/redirect, browser-free fixture, run/cache isolation, HTTP timeout/schema/configuration, advisory-regression contracts, and delayed-primary locator readiness.
- Added `qa:migrate` / `migration:assess` for read-only incremental adoption assessment of existing Playwright suites rather than requiring a bulk rewrite.
- Added architect-review closure and pilot metrics documentation. Customer/pilot evidence is deliberately not fabricated; market-readiness claims remain gated on measured adoption/benchmark results.

# TestigentAI v1.4.2 — Multi-project capability isolation and dormant E2E sample hardening

- Fixed a multi-project isolation defect where a machine/repository-level `DB_TYPE` value could override a project's configured `database.type=none` and accidentally activate `@db` scenarios in unrelated products.
- Database type is now exclusively owned by `projects/<project>/config/<env>.json`; environment variables provide only connection secrets and adapter settings. This keeps customer/project capability boundaries deterministic.
- Added a regression contract proving a leaked global `DB_TYPE=postgres` cannot activate DB capability for a project configured with `database.type=none`.
- Hardened the demo UI/API/DB reference scenario to explicitly open the Todo application before interacting with the work-item input. The missing navigation had been dormant while the optional DB capability correctly skipped the scenario.
- Preserved lazy deterministic-first healing. When the dormant cross-layer scenario ran from a blank page, AI was allowed to propose recovery but semantic safety correctly refused to hide the test-design defect.
- Updated README, onboarding/database documentation and `.env.example` to remove the shared DB-type override pattern and clarify project-owned database selection.
- No auth, reporting, proposal approval, portfolio selection, AI provider, CI merge, or known-defect semantics were weakened.

## TestigentAI v1.4.1 — Lazy AI recovery, governed cross-layer authoring and business portfolio reporting

- Preserved the v1.4.0 dynamic multi-project runner while hardening the AI boundary: normal tests no longer instantiate an AI provider merely because AI is enabled.
- UI healing remains available across the suite with the safe order primary locator -> deterministic fallback -> validated cache -> lazy AI fallback; AI is created only when deterministic recovery is exhausted.
- Dedicated local/GitHub/Azure AI lanes now set the same explicit `ALLOW_AI_TESTS=true` selection contract.
- Portfolio `--include-ai` performs one provider/configuration preflight before executing projects, while dry-run remains secret-free.
- Added a lightweight business-first portfolio dashboard at `reports/multi-project/<RUN_ID>/index.html` without changing existing per-project business/engineering reports.
- Extended portfolio facts with executed/not-applicable/blocked scenarios, quality failures, known defects, CI blockers, validated healing and AI usage.
- Extended the existing requirement-intelligence/proposal pipeline to author UI, API, database and mixed E2E automation using one workflow; no parallel agent framework or extra onboarding command surface was introduced.
- Human approval remains the trust boundary before generated automation is promoted into normal project tests.
- Added generated-code safeguards: API proposals stay behind domain/BaseApiClient boundaries and may not invent contracts; database proposals are read-only by default and mutating/destructive SQL is blocked from proposal approval.
- Added recovery-boundary documentation separating UI locator healing, authentication recovery, API resilience and database resilience so business-contract changes are never silently healed.
- Simplified new-project onboarding documentation and clarified automatic portfolio discovery/customer grouping.
- Kept local portfolio execution intentionally sequential across products while Playwright parallelizes within each product; CI sharding remains the scale-out mechanism, avoiding nested browser/API/DB oversubscription and unnecessary framework complexity.


## v1.4.0 — Multi-project customer portfolio execution

- Added dynamic `test:projects` runner with `--all`, `--apps`, and `--group` selectors.
- New projects are automatically included by `--all` when they provide `projects/<project>/config`.
- Added customer/portfolio groups through `config/project-groups.json`.
- Added common `--env` and per-project `--env-map` environment selection.
- Portfolio execution continues through failures by default and supports optional `--fail-fast`.
- Added `--dry-run` execution-plan preview and `--include-ai` explicit AI-tag opt-in.
- Added cross-project machine-readable summary at `reports/multi-project/<RUN_ID>/summary.json`.
- Added framework contracts for dynamic discovery, mixed environments, group selection and fail-closed ambiguous environment handling.
- Added dedicated multi-project documentation and product README guidance.
## v1.3.9 - Zero-selection and empty-shard reporting hardening

- Fixed the SDET Practice PR-profile selection gap by tagging the critical CRUD business scenario with `@smoke`; `TEST_PROFILE=pr` now selects a real business test instead of producing an empty run.
- Added scale-audit `PROFILE_EMPTY` governance so any configured include-tag profile that has no matching project test is release-blocking before CI.
- Core CI workers now use Playwright `--pass-with-no-tests` so over-sharding does not fail a worker merely because that shard receives no tests.
- Core bundle markers auto-detect whether a worker actually produced business scenarios; empty workers are recorded explicitly instead of being misclassified as missing artifacts.
- Merge validation now checks expected core worker topology separately from produced business reports. Empty over-sharded workers are valid, missing workers remain invalid, and an entire profile selecting zero business scenarios fails with an actionable profile/grep/tagging diagnostic.
- `test:project` clears stale business output before execution, prints the resolved selection policy, and rejects successful local runs that produce no business scenarios unless `--pass-with-no-tests` was explicitly requested for CI shard handling.
- Retains v1.3.8 sequential/sharded + AI-aware merge semantics and v1.3.7 authentication hardening.

## v1.3.8 - Dynamic core/AI merge topology

- Replaced the hard-coded two-report merge assumption with configurable core worker planning: `1` runs sequentially without Playwright `--shard`; values greater than `1` generate the corresponding shard matrix.
- Added CI business-bundle topology markers so merge validation distinguishes required core shard reports from the optional dedicated AI lane.
- Core completeness and AI completeness are now validated independently; an AI report can never satisfy a missing core shard.
- When the AI lane is requested, CI records whether `@ai` tests exist. No-AI projects are treated as not applicable, while detected AI tests require a dedicated AI business report containing at least one `@ai` result.
- Merged execution facts and GitHub step summaries now expose core report count, AI report count, AI-specific result count, and aggregated AI runtime calls.
- GitHub Actions supports `workflow_dispatch.shards` and repository variable `CI_SHARDS`; Azure `shards: 1` now runs true sequential execution and larger values run sharded execution.
- Retains v1.3.7 automatic-auth verification hardening and all v1.3.6 merged-report safety behavior.


## v1.3.7 - CI auth verification hardening

- Removed the ambiguous SDET Practice `Login` button as an unauthenticated proof. The live UI can expose that control even when a freshly issued JWT is already present in browser storage, which caused CI to reject valid provider output.
- Kept `sdet_access_token` as the deterministic browser-state proof used by the generic auth lifecycle.
- Added a regression contract so the project cannot silently reintroduce the ambiguous control check.
- No generic auth-core safety rules were weakened.

## v1.3.6 - CI merged-report hardening

- Replaced the GitHub merged-quality summary Bash/Node heredoc with the dedicated `ci:business:summary` script, eliminating indentation-sensitive `NODE` terminator failures.
- Marked the GitHub step-summary publication as informational (`continue-on-error`) so a summary-rendering problem cannot falsely fail an otherwise valid merged report.
- Added a deterministic missing/corrupt-report fallback summary that preserves the earlier merge/validation step as the root failure.
- Added `EXPECTED_BUSINESS_REPORTS` enforcement to fail closed when a required shard business bundle is missing instead of publishing partial quality coverage as complete.
- Wired the source-count guard into GitHub Actions and Azure Pipelines; optional AI reports remain additive.
- Changed final GitHub artifact publication to warn on missing files so it cannot obscure the actual merge failure with a secondary upload error.
- Extended executable reporting contracts and static release checks for summary rendering, missing-shard rejection, and no-heredoc workflow governance.

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

## v1.6.0 pre-tag CI hardening — AI retry budget and failed-rerun provenance

Connected Node 22.23.2 validation passed locally (37/37 review-hardening, 124/124 framework regression, security gate clean), and PR #11 plus its rerun passed. Trusted-main run `34755127762` then exposed two pre-tag conditions that are corrected in this candidate:

- Gemini health/model validation succeeded, but two slow HTTP 503 responses consumed most of the old 90-second total retry budget. Gemini retry allocation now reserves future retry/backoff time, defaults the per-attempt CI timeout to 30 seconds, retries timeout by default, and retains strict failure after bounded attempts.
- GitHub `rerun --failed` may not rerun already-successful core shard jobs. Report merge now resolves immutable same-workflow-run artifacts per shard, records `_rerun-resolution.json`, carries technical blobs from the same source attempts, rejects cross-run/future/duplicate provenance, and allows mixed attempt IDs only when explicitly verified as members of the same workflow run.

Historical pre-tag instruction: no `v1.6.0` tag was to be created until replacement trusted-main, rerun proof and release compatibility were green; those gates later completed successfully. See `docs/46-v1.6.0-PRE-TAG-CI-HOTFIX.md`.


## v1.6.0 pre-tag closure — workflow-run artifact acquisition

- Trusted-main R3 proved the AI retry budget reaches all configured attempts; a later failed-only rerun passed Gemini provider generation and AI healing.
- The same rerun exposed that default artifact-download context can omit required core artifacts from resolver input even when same-workflow evidence exists.
- Merge downloads now supply `github-token`, `repository`, and `run-id` so artifact lookup uses the authenticated workflow-run API path before strict provenance resolution.
- Intermediate core/AI artifacts are retained whenever a required execution lane fails; cleanup occurs only after required lanes plus final merge/validation/upload succeed.
- Static and synthetic rerun contracts protect acquisition, retention, shard-attempt selection, technical/business alignment, and cross-run rejection.
- Historical pre-tag state: `v1.6.0` remained untagged until replacement main CI, main rerun and the 5/5 compatibility matrix passed; those gates later completed successfully.

## v1.6.0 final certification and v1.6.1 operational candidate

TestigentAI **v1.6.0 is the certified immutable baseline**. Annotated tag `v1.6.0` resolves to certified commit `4225e151fadcc85fd0a9861b385bda82bd1c96c0`. Tag-triggered Release Compatibility run `34760349497` passed Ubuntu Chromium/Firefox/WebKit, macOS WebKit and Windows Chromium.

The current development candidate is **v1.6.1 — AI Operational Reliability**. It keeps v1.6.0 deterministic release/evidence semantics unchanged and adds:

- blocking provider-neutral `AI Deterministic Safety`;
- non-blocking `AI Live Provider Canary` with `HEALTHY`, `DEGRADED`, `MISCONFIGURED` and `SKIPPED`;
- environment-scoped, sanitized, bounded provider-health history;
- compact dashboard reliability signal plus one-click `ai-provider-health.html`;
- immutable canary-artifact selection for rerun-safe AI evidence inclusion;
- fail-closed behavior when expected canary evidence is missing;
- explicit `SKIPPED` evidence when a canary is intentionally not run;
- matching GitHub Actions and Azure Pipelines policy boundaries.

Connected Node 22 `npm run validate:final` has passed for v1.6.1. It remains a **candidate**, not a certified release, until PR/main/rerun CI and the 5/5 Release Compatibility matrix pass.
