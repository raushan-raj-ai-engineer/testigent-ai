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

CI caches `.report-history/<APP>` and only the final merge appends a release-history point. Shards must not become independent trend points. This gives the trend chart one point per final CI run.

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
