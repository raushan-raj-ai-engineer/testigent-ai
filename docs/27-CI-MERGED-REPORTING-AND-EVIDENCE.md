# CI Merged Reporting and Evidence Standard

## Purpose

TestigentAI publishes one authoritative report per CI run even when Playwright executes across normal shards and a dedicated AI/healing lane. Shard reports are transport artifacts; stakeholders consume only the merged technical and business reports.

## Metric scope

The business dashboard distinguishes four scopes:

- **Selected** — business scenarios selected for the run; framework/agent seed checks are excluded and shown separately.
- **Applicable** — selected scenarios relevant to the configured project/environment.
- **Executed** — applicable scenarios that reached a final passed/failed business outcome.
- **Not applicable** — intentionally unavailable capabilities such as an optional database configured as `none`.
- **Blocked** — applicable scenarios that did not execute because a prerequisite/review/auth/dependency blocked them.

Execution coverage is therefore:

```text
Executed / Applicable × 100
```

A not-applicable DB test does not reduce execution coverage and does not count in executed database-layer coverage. A blocked scenario does reduce execution coverage and puts the release gate into attention state.

Quality remains independent:

```text
Quality failed = KNOWN_DEFECT + FAILED
CI-blocking = FAILED + UNEXPECTED_PASS
```

A registered known defect remains product-quality debt but can be accepted/non-blocking. It must never be presented as a clean pass.

## CI ownership

Normal shards run with `--grep-invert="@ai"`. The dedicated AI/healing lane owns `@ai` scenarios when enabled. This prevents duplicate execution and double counting.

CI then downloads all blob reports and business bundles and performs exactly one final merge:

```text
normal shard blobs ─┐
normal business facts├─> merged Playwright HTML + merged TestigentAI dashboard
AI/healing blob ────┤
AI/healing facts ───┘
```

`merge-business-reports.ts` rejects duplicate `project:testId` values rather than silently overwriting them. Validated healing audit records and AI runtime records are de-duplicated and merged once. The final business JSON records aggregation metadata (`mode=merged`, source report count and source run IDs).

## History

CI caches `.report-history/<APP>/<ENV>` and only the final merge appends a release-history point. Shards must not become independent trend points. This gives the trend chart one point per final CI run.

## Evidence standard

For every actual failed/timed-out **UI** scenario, TestigentAI captures a final framework screenshot and attaches it through Playwright. Because it is a Playwright attachment, it travels through blob merging into the technical report and is also materialized into the business report.

Business report behavior:

- failed `test.step()` expands with **Failure evidence**;
- screenshots render inline;
- retained video can be previewed/linked;
- trace/zip/text evidence remains linked;
- ANSI terminal formatting is stripped from business error text;
- evidence links are rebased during shard merge.

`ci:business:validate` fails publication if a failed UI scenario has no materialized screenshot. API/DB failures do not require visual evidence.

## Reporting contract gates

`npm run reporting:contract` validates single-run semantics and evidence rendering.

`npm run reporting:merge-contract` validates:

- multiple shard + AI bundle aggregation;
- not-applicable denominator behavior;
- skipped DB exclusion from executed layer coverage;
- healing/AI records merged once;
- duplicate business scenarios rejected;
- final merged dashboard creation;
- failed UI screenshot rebasing/materialization into the final merged bundle.

For Azure Pipelines, multi-artifact download patterns match the artifact-name path segment (for example `business-$(APP)-*/**` and `blob-$(APP)-*/**`) before the merge job flattens technical blobs and recursively reads business bundles.

Both run through `npm run reporting:contract`, which is part of `qa:validate` / `validate:final`.

## Stakeholder reading order

1. Release decision.
2. Selected / Executed / Applicable / Not applicable / Blocked.
3. Quality failed, known defect debt, CI blockers.
4. Reliability signals (retry, healing, AI).
5. Business scenarios and failed-step evidence.
6. Playwright HTML/trace for engineering-level debugging.

## Merge-job hardening (v1.3.6)

The GitHub merge job publishes its step summary through `npm run ci:business:summary`; it does not embed Node.js in a Bash heredoc. This avoids whitespace/terminator failures in generated runner scripts and keeps summary rendering non-blocking when an earlier merge gate already failed.

Both GitHub Actions and Azure Pipelines now pass `EXPECTED_BUSINESS_REPORTS` to the business merge. The merge fails closed when fewer required non-AI shard bundles are present, preventing a partial shard download from being published as a complete quality report. The final artifact upload uses `if-no-files-found: warn` so it does not replace the real merge error with a secondary missing-artifact error.


## Dynamic sequential/sharded + AI merge topology (v1.3.8)

The merged business report treats **core execution** and the optional **AI lane** as separate completeness contracts. This prevents an AI artifact from accidentally satisfying a missing Playwright shard.

- Core workers are configurable. `1` means a true sequential run with no `--shard` argument; `N > 1` means `N` Playwright shards.
- GitHub Actions: use workflow-dispatch input `shards`, or repository variable `CI_SHARDS` for push/PR defaults.
- Azure Pipelines: use the existing `shards` parameter; `shards: 1` is sequential.
- Each core worker writes `ci-bundle.json` with its shard identity before artifact upload.
- The optional AI job writes an AI-lane marker even when the project has no `@ai` tests.
- If AI tests are detected, merge requires the AI business report and at least one business result tagged `@ai`.
- If no AI tests exist, the AI lane is **not applicable**, not failed.
- Merged facts expose `aggregation.coreReports`, `aggregation.aiReports`, and `aggregation.aiResults`; `aiUsage` continues to aggregate provider/runtime calls independently.

Examples:

```bash
# Local/sequential merge: one core report is valid when no strict count is supplied.
npm run report:merge:business -- all-business-reports

# CI sequential contract.
EXPECTED_CORE_WORKERS=1 npm run report:merge:business -- all-business-reports

# CI 4-shard contract + planned AI lane.
EXPECTED_CORE_WORKERS=4 EXPECT_AI_LANE=true npm run report:merge:business -- all-business-reports
```


## Zero-selection vs empty-shard behavior (v1.3.9)

Core worker topology and business report count are intentionally different concepts. A run may request more shards than selected tests. CI therefore records one `ci-bundle.json` marker per planned core worker and lets each marker declare whether that worker actually executed business scenarios.

- Empty shard because of over-sharding: valid; no fake business report is required.
- Missing worker marker: invalid; the CI topology is incomplete.
- Worker says it selected tests but its business report is missing: invalid.
- Every core worker reports `hasTests=false`: invalid; the selected profile/grep combination matched zero business scenarios.

Core CI workers use Playwright `--pass-with-no-tests` only so an intentionally empty shard can reach the merge/topology gate. The final merge still fails closed when the whole execution selected zero business scenarios. Local `test:project` runs do not opt into that behavior by default and fail with `NO_BUSINESS_TESTS_SELECTED` if a successful Playwright command produces no business report rows.
