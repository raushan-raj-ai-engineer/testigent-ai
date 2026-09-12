# TestigentAI v1.2.8 Verification Report

## Release scope

This report records cumulative verification through v1.2.8. The current release deep-reviews stakeholder reporting, failed-step evidence, shard/AI aggregation, CI history and execution-scope semantics while preserving the reusable multi-project architecture.

## Dependency-independent verification completed in the release workspace

- Release static check: PASS — 301 files before the final verification report/manifest refresh.
- Offline release/security/reproducibility check: PASS — 24 JSON files, 293 text files, 18 required artifacts.
- TypeScript/TSX parser check: PASS — 203 files, 0 syntax errors.
- Architecture check: PASS — demo and sdet-practice, 0 issues.
- Reusable export comment audit: PASS — 154 declarations, 0 issues.
- Declarative pure contracts: PASS — application-root navigation, same-origin absolute navigation, cross-origin denial, Draft 2020-12 schema, schema/action alignment, semantic locator catalog.
- Shell syntax: PASS.
- DOCX structural integrity: PASS for both shipped documents.
- Declarative authoring DOCX challenge-log visual QA: 18/18 rendered pages reviewed clean during release preparation.
- CycloneDX SBOM: generated for v1.2.0 with 149 locked components.

## Full dependency-backed verification status

A fresh `npm ci` could not be completed in the packaging sandbox because package-registry access is unavailable/intermittent in this environment. Therefore this report does not claim that the v1.2.0 dependency-backed TypeScript/Playwright suite passed here.

Run the following on a normal networked development/CI machine after extracting the ZIP:

```bash
./VERIFY_RELEASE.sh
```

That command performs a clean `npm ci`, `validate:final`, framework critical tests, AI-evaluation contract tests, SBOM generation, and the offline release checks.

## Upgrade verification

The final package includes a conflict-safe, idempotent upgrade manifest targeting the reconstructed v1.1.2 stable baseline (including the PR CI hardening and TodoMVC declarative-route hotfix that were merged after the v1.1.2 ZIP). The release process re-applies the upgrade twice to prove idempotency before packaging.


## v1.2.1 database-capability correction

The v1.2.1 patch centralizes optional/required database gating. Static/type-level validation in the packaging workspace verifies the resolved capability contract and ensures project specs no longer contain direct `DB_TYPE` skip logic. On the user's macOS validation environment, the v1.2.0 baseline had already passed release-static, architecture, framework-health, scenario-doctor, TypeScript typecheck, authenticated SDET UI execution and non-DB project tests; the observed remaining failure was the intentionally unconfigured `@db` test. v1.2.1 addresses that defect at framework level.


## Packaging-workspace validation for v1.2.1

Completed before packaging this patch:

- release static gate: PASS — 325 files on the clean working tree
- offline release/security/reproducibility gate: PASS — 27 JSON files, 317 text files, 18 required artifacts
- architecture gate: PASS — demo and sdet-practice, zero issues
- TypeScript/TSX parser/transpile scan: PASS — 221 source files, zero syntax diagnostics
- focused semantic typecheck for runtime/config/database/preflight core: PASS
- database runtime resolution: PASS for optional disabled, incomplete override, fully configured enabled, and required-unavailable fail-fast cases
- automatic enterprise DB capability fixture: PASS for optional skip, normal non-DB run, required-not-hidden, and enabled-run cases
- negative architecture contract: PASS — direct `process.env.DB_*` access in a project spec is rejected
- project-template generation + release/architecture gates: PASS, followed by clean removal of the temporary project
- package/package-lock root version consistency: PASS at 1.2.1
- CycloneDX SBOM regenerated from the lockfile: PASS — 149 components

A dependency-backed Playwright run is not claimed in the packaging sandbox because npm dependencies are intentionally absent and registry restoration is unavailable here. The immediately preceding v1.2.0 artifact was dependency-backed validated on the user's macOS machine: release/static, architecture, framework health, scenario doctor, TypeScript typecheck, authenticated SDET UI execution and non-DB project tests passed. The one observed failure was the unconfigured optional `@db` test; this v1.2.1 patch specifically moves that decision into the framework capability layer.

## v1.2.4 robust-locator correction

Repeated macOS validation of v1.2.2/v1.2.3 showed that the framework was safely rejecting the stale SDET Create User locator, but the recovery path was still too literal and the default `suggest` mode prevented reviewed deterministic fallbacks from being useful as an execution-resilience layer. v1.2.4 fixes the abstraction instead of adding another single selector.

Packaging-workspace validation completed for v1.2.4:

- release static gate: PASS
- TypeScript/TSX parser/transpile scan: PASS — 221 source files, zero syntax diagnostics
- package/package-lock root version consistency: PASS at 1.2.4
- semantic role-pattern contract added for Create/Add/New User wording drift
- deterministic fallback contract added for default `HEALING_MODE=suggest`
- unresolved-locator diagnostic contract added (`LOCATOR_RESOLUTION_FAILED` + bounded visible-control evidence)
- SDET User Management navigation is guarded by a readiness post-condition; Create User structural fallbacks remain guarded by the modal-visible post-condition
- reporting contract remains fail-closed: only `validated` healing records can produce Self-healed / `PASSED WITH HEALING`; rejected, suggested and unverified records remain evidence only

The packaging sandbox still does not claim a dependency-backed Playwright execution because registry restoration is unavailable. Final runtime acceptance remains `npm ci && npm run qa:validate -- --with-tests` on the user's normal macOS/CI environment.

## v1.2.5 authentication-state correction

macOS validation of v1.2.4 proved the remaining failure was not a locator defect: both the agent seed and user-management test landed on an unauthenticated page whose only visible interactive control was `Login`. v1.2.5 moves authentication validity ahead of locator/healing decisions.

Packaging-workspace validation completed for v1.2.5:

- release static gate: PASS
- offline release/security/reproducibility gate: PASS
- TypeScript/TSX parser/transpile scan: PASS — 215 source files, zero syntax diagnostics
- auth-state pure contracts: PASS — non-empty Playwright state detection, empty-state rejection, sessionStorage companion persistence/restore, valid token evidence, missing token rejection and visible Login rejection
- required storage-state project policy: release gate now requires project-configured authentication verification evidence
- `qa:auth` contract: captured state is verified in a second fresh browser context before promotion; failed capture leaves the previous known-good state intact
- runtime contract: sessionStorage is restored through the reusable enterprise fixture and authenticated navigation rejects invalid sessions before healing
- reporting regression guard: business reporter and HTML renderer bytes are unchanged from v1.2.4; validated-healing-only KPI rules remain enforced by `release:static`

Dependency-backed browser execution is intentionally left for the user's normal macOS/CI environment because package-registry restoration in the packaging sandbox is unavailable/intermittent. Final runtime acceptance is `npm ci && npm run qa:auth && npm run qa:validate -- --with-tests`.


## v1.2.8 merged reporting and evidence correction

The uploaded v1.2.7 business dashboard exposed scope and evidence issues: optional disabled DB coverage reduced execution coverage, skipped DB appeared in executed layer coverage, accepted known-defect debt could force an attention gate, and failed-step screenshot/video evidence was not guaranteed to survive shard merge. v1.2.8 corrects those issues at the framework/CI layer.

Packaging-workspace validation completed for v1.2.8:

- reporting runtime contract: PASS — accepted known defect, unexpected failure/pass, not-applicable coverage, blocked applicable execution and failed-step inline evidence
- merged reporting contract: PASS — normal shards + dedicated AI bundle, 4 selected / 3 applicable / 3 executed / 1 not applicable, one validated healing event, one AI runtime call, duplicate scenario rejection
- merged evidence contract: PASS — known-defect UI failure screenshot is rebased from shard bundle, materialized into the final bundle and rendered inline under the failed step
- release static gate: PASS
- offline release/security/reproducibility gate: PASS
- GitHub CI: normal shards exclude `@ai`; final merge combines all normal + AI technical blobs and business facts once
- Azure CI: multi-artifact download patterns match artifact-name path segments (`blob-$(APP)-*/**`, `business-$(APP)-*/**`) before final merge
- CI bundle validation: failed UI scenarios require materialized screenshot evidence before publication
- report history: final merged run appends one trend point; shard-local runs do not pollute trends
- package/package-lock/SBOM version consistency: 1.2.8

A dependency-backed browser execution is not claimed in the packaging sandbox because locked npm restoration is unavailable/intermittent here. The final runtime acceptance remains `npm ci && npm run qa:auth && npm run qa:validate -- --with-tests` on the user's macOS/CI environment.
