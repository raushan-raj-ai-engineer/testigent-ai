# Business Reporting Standard

## Purpose

TestigentAI keeps Playwright as the technical evidence source and adds a business outcome model on top. The report must answer two different questions without mixing them:

1. **Is product quality healthy?**
2. **Should this automation result block CI/release flow?**

A registered known defect is still a product-quality failure. It is non-blocking only because the team explicitly accepted and registered the defect. This avoids the misleading native expected-failure effect where a failing scenario can appear inside Playwright's successful final count.

## Industry benchmark used for the review

The reporting design was compared against common patterns from:

- **Playwright HTML/Trace** — excellent per-test debugging, steps, attachments, trace, screenshots/video and filtering. TestigentAI keeps this as the engineering evidence layer instead of recreating it.
- **Allure Report** — strong history/retries and stakeholder-friendly drill-down. TestigentAI keeps project-scoped history and surfaces retry/flaky/healing status separately.
- **ReportPortal** — strong run analytics, issue segmentation, flaky/most-failed/slow-test views and "to investigate" style triage. TestigentAI adopts the business idea of separating understood defect debt from new/uninvestigated failures.

The dashboard is intentionally not a visual clone of another product. It uses the reporting patterns that improve decision speed while preserving TestigentAI's multi-project/healing/AI governance model.

## Business outcome model

| Business outcome | Product quality | CI blocking | Meaning |
| --- | --- | --- | --- |
| `PASSED` | Pass | No | Clean business pass. |
| `PASSED_WITH_HEALING` | Pass | No | Passed after semantically validated locator recovery. |
| `PASSED_AFTER_RETRY` | Pass | No | Final pass after one or more failed attempts; stability debt remains visible. |
| `KNOWN_DEFECT` | **Fail** | No | Failure matches an explicitly registered open product defect. |
| `FAILED` | **Fail** | **Yes** | Unexpected product/test failure requiring investigation. |
| `SKIPPED` | Neutral | No | Not executed; reason is separately categorized. |
| `UNEXPECTED_PASS` | Pass | **Yes** | Registered defect did not reproduce; verify fix and remove stale expected-failure marker. |

## Counts and rates

```text
quality failed = KNOWN_DEFECT + FAILED
CI-blocking issues = FAILED + UNEXPECTED_PASS
quality pass = PASSED + PASSED_WITH_HEALING + PASSED_AFTER_RETRY + UNEXPECTED_PASS
quality pass rate = quality pass / (quality pass + quality failed)
```

Skipped tests do not reduce the quality pass rate. They reduce **execution coverage** instead. This separates product quality from test execution completeness.

Native Playwright status is retained in JSON/CSV for technical correlation, but the business dashboard uses the business outcome above.

## Release decision

The business gate supports three states:

- `PASSED` — no configured gate concern.
- `PASSED_WITH_ACCEPTED_RISK` — no CI-blocking issue, but registered known-defect debt remains and the configured threshold is still satisfied.
- `ATTENTION_REQUIRED` — quality threshold, unexpected failure/pass or configured high-impact rule requires review.

This business gate does not rewrite Playwright's process exit code. CI remains based on the real test runner and pipeline policy.

## Dashboard information hierarchy

### Executive layer

The first screen answers release questions quickly:

- quality pass rate
- quality failed
- known-defect debt
- CI-blocking issues
- execution coverage
- skipped
- flaky
- self-healed
- duration
- release decision

### Triage layer

The next layer separates:

- **Investigate now** — unexpected failures + unexpected passes
- **Accepted defect debt** — registered known defects
- **Flaky/retry recovered** — reliability debt
- **Rejected healing** — diagnostic framework evidence

The dashboard also shows slowest scenarios, quality trend, business impact and unexpected-failure clusters.

### Engineering drill-down

Test Explorer retains:

- scenario search/filter/sort
- business outcome filter
- UI/API/DB classification
- tags and failure categories
- `test.step()` tree
- retry/flaky/healing state
- known-defect metadata
- screenshots/trace/text evidence

Healing and AI audits remain under **Engineering diagnostics** so they do not dominate the business view.

## Known-defect governance

Known defects must live under:

```text
projects/<project>/known-defects.json
```

The test must add the framework annotation before using Playwright expected-failure semantics:

```ts
const defect = KnownDefectRegistry.get('my-project', 'BUG-123');
if (defect) {
  KnownDefectRegistry.annotate(testInfo, defect);
  test.fail(true, `${defect.id}: ${defect.title}`);
}
```

The explicit `known-defect` annotation is the reporting source of truth. A generic `test.fail()` is not automatically treated as a registered product defect.

If a registered defect unexpectedly passes, the business outcome becomes `UNEXPECTED_PASS` so the team is prompted to verify the fix and remove the stale expected-failure rule.

## Cross-channel consistency

The same deterministic outcome model is used by:

- interactive business dashboard
- `business-report.json`
- CSV export
- static HTML email attachment
- email body/text
- executive Markdown summary
- merged CI shard report
- terminal business summary
- report history/trend

No channel is allowed to calculate its own independent pass/fail semantics.

## Reporting trust rules

- Known defects count as quality failed.
- Only explicit known-defect annotations can create `KNOWN_DEFECT`.
- Only semantically validated healing can create `PASSED_WITH_HEALING`.
- Rejected/suggested/unverified healing remains evidence only.
- AI may narrate evidence but cannot alter outcome, pass rate, gate or defect counts.
- Secrets/tokens remain redacted and auth state is never copied into reports.

## Validation and terminal visibility

`npm run reporting:contract` executes the deterministic business-outcome model and the real dashboard/email renderers with representative scenarios. `npm run qa:validate` includes this gate before type checking and project validation.

Playwright preserves its native expected-failure semantics. Therefore a registered `test.fail()` scenario can appear as expected execution in Playwright's final count even though the functionality is still broken. TestigentAI deliberately does not rewrite the Playwright runner result. Instead the terminal business summary, dashboard, CSV, email and executive Markdown use **Quality failed = known defects + unexpected failures**. This keeps CI semantics honest while keeping stakeholder quality semantics equally honest.


## v1.2.8 scope and CI aggregation clarification

The dashboard reports **Selected**, **Applicable**, **Executed**, **Not applicable** and **Blocked** explicitly. Execution coverage is `Executed / Applicable`. Not-applicable capability skips are excluded from the denominator; blocked skips remain applicable and therefore reduce coverage. Executed layer coverage excludes all skipped scenarios.

CI shard reports are intermediate transport artifacts. Normal shards exclude `@ai`, a dedicated AI/healing lane may execute AI-tagged scenarios, and one final merge creates the stakeholder dashboard. Duplicate scenario IDs fail the merge. Validated healing and AI runtime facts are aggregated once. Failed UI scenarios must carry a materialized screenshot, rendered inline under failed-step evidence. See `docs/27-CI-MERGED-REPORTING-AND-EVIDENCE.md`.
## v1.2.9 evidence presentation rule

For a failed business step, the business dashboard presents one primary screenshot inline at the failure point. The scenario-level **Additional attachments** area excludes image evidence already represented inline and retains video, trace, logs, error context, and other unique artifacts. This prevents duplicate screenshots without reducing evidence availability.



## Portfolio reporting

Multi-project/customer execution adds an estate-level business view under `reports/multi-project/index.html` while preserving each project dashboard as the detailed source. The portfolio page uses the same deterministic project reports and does not recalculate alternative pass/fail semantics. It highlights project gate, selected/executed scenarios, quality failures, known defects, CI blockers, validated healing and AI-call counts. Technical traces remain in project-level drill-down reports.
