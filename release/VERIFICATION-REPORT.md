# TestigentAI v1.3.6 Verification Report

## Scope

This patch hardens the CI merged-report path after the GitHub merge job failed while publishing the step summary. The v1.3.5 framework baseline had already completed the user's full `npm run validate:final` successfully; v1.3.6 changes are limited to CI report merge/summary governance and supporting contracts/docs.

## Root cause closed

The GitHub Actions `run: |` block used a Bash heredoc for inline Node.js. The closing `NODE` marker inherited indentation inside the generated runner script, so Bash did not recognize it as the delimiter and ended with `unexpected end of file`.

## v1.3.6 corrections

1. Replaced the inline Bash/Node heredoc with `npm run --silent ci:business:summary >> "$GITHUB_STEP_SUMMARY"`.
2. Made the step-summary publication informational/non-blocking so it cannot falsely fail a valid merged report.
3. Added a missing/corrupt-report fallback summary that points engineers to the earlier merge/validation failure.
4. Added `EXPECTED_BUSINESS_REPORTS` merge enforcement so missing shard bundles cannot silently produce partial coverage.
5. Wired the report-count guard into both GitHub Actions and Azure Pipelines.
6. Changed the final GitHub artifact upload to warn when no final report exists, preserving the original merge error as the root failure.
7. Extended reporting/static release contracts to prevent heredoc regression and verify merged-summary/source-count behavior.

## Verification performed in the release build environment

- GitHub workflow YAML parse: PASS
- Azure Pipelines YAML parse: PASS
- GitHub summary shell syntax: PASS
- dependency-free TypeScript transpile of all changed TS files: PASS
- step-summary functional rendering with merged facts: PASS
- step-summary missing-report fallback: PASS
- `node scripts/release-static-check.mjs`: PASS
- `node scripts/offline-release-check.mjs`: PASS
- JSON/YAML/shell syntax checks: PASS
- package/package-lock version synchronization: `1.3.6`
- SBOM regenerated: 149 components
- release SHA-256 manifest regenerated and independently verified after clean ZIP extraction

## Dependency-backed validation

The build container could not complete a fresh `npm ci` because registry access timed out. No claim is made that this container reran the entire Playwright suite. The user had already confirmed the v1.3.5 dependency-backed `validate:final` suite passed; after applying this CI-only patch, the authoritative final check remains the normal GitHub CI run or `npm ci && npm run validate:final` on a network-enabled runner.
