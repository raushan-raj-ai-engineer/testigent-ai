# TestigentAI v1.3.8 Verification Report

## Scope

This patch makes CI report aggregation execution-mode aware and validates the dedicated AI lane independently from normal project workers. It retains the v1.3.7 automatic-auth verification hardening and the v1.3.6 merged-report summary hardening.

## Problems closed

1. The GitHub merge job assumed two non-AI business reports even when users may run sequentially or choose another shard count.
2. AI business bundles were downloaded by the same wildcard and could accidentally contribute to a generic report count, allowing one core shard plus one AI bundle to look like two complete core shards.
3. A planned AI lane did not have a deterministic merge-time contract proving whether `@ai` tests existed and, when they did, that an AI-specific business result was actually produced.

## v1.3.8 corrections

- Added dynamic GitHub core worker planning: one worker runs sequentially without `--shard`; larger values generate the matching shard matrix.
- GitHub supports workflow-dispatch `shards` and repository variable `CI_SHARDS`.
- Azure `shards: 1` now runs true sequential execution; larger values use Playwright sharding.
- Added `ci-bundle.json` markers for core and AI business artifacts.
- Merge validation now enforces `EXPECTED_CORE_REPORTS` independently from `EXPECT_AI_LANE`.
- AI reports can never satisfy a missing core worker count.
- A requested AI lane records whether `@ai` tests are present. No-AI projects are treated as not applicable.
- When AI tests are detected, merge requires a dedicated AI business report with at least one `@ai` result.
- Aggregated execution facts expose core report count, AI report count and AI-specific result count; AI runtime usage records continue to merge separately.
- GitHub step summary now surfaces AI-specific results and core/AI bundle counts.
- Added executable reporting regressions for sequential mode, missing core shard masked by AI, missing AI report, empty AI result and AI-not-applicable behavior.

## Verification performed in the release build environment

- `node scripts/release-static-check.mjs`: PASS
- `node scripts/offline-release-check.mjs`: PASS
- reporting merge functional contract: PASS
- sequential one-report merge: PASS
- missing-core-with-AI masking regression: PASS
- AI detected/report missing regression: PASS
- AI report without `@ai` result regression: PASS
- AI lane with no AI tests: PASS as not applicable
- reusable export comment audit: 183 declarations, 0 issues
- dependency-free TypeScript transpile: 237 files, 0 syntax errors
- JSON parse: 27 files PASS
- YAML parse: 6 files PASS
- GitHub plan simulation: 1-worker and 4-worker matrix PASS
- package/package-lock version synchronization: `1.3.8`
- SBOM regenerated: 149 components
- release SHA-256 manifest regenerated

## Dependency-backed validation

The isolated build container could not complete a fresh `npm ci` because registry access timed out. The changed merge/reporting contracts were executed with the available TypeScript runtime in transpile-only mode and passed. The authoritative end-to-end certification remains `npm ci && npm run validate:final` plus the GitHub/Azure pipeline on a network-enabled runner.
