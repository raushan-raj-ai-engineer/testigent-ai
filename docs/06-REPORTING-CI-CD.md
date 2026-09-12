# Reporting and CI/CD

Every project writes isolated output:

```text
reports/<APP>/playwright-html/
reports/<APP>/business/
reports/<APP>/business-merged/
test-results/<APP>/
.report-history/<APP>/
```

The business dashboard contains execution KPIs, status/layer graphs, searchable/filterable test explorer, step drill-down and materialized evidence. Email supports preview mode so SMTP is not required for local report validation.

## Business-standard status model (v1.2.6)

The business report now separates **raw Playwright execution** from **product quality** and **CI blocking**:

```text
PASSED / PASSED_WITH_HEALING / PASSED_AFTER_RETRY  -> quality pass
KNOWN_DEFECT                                        -> quality fail, accepted/non-blocking
FAILED                                              -> quality fail, CI blocking
SKIPPED                                             -> neutral; lowers execution coverage only
UNEXPECTED_PASS                                     -> quality pass, CI blocking until stale defect marker is reviewed
```

`Quality failed = KNOWN_DEFECT + FAILED`. A known product defect is therefore never displayed as an ordinary pass even though Playwright expected-failure semantics may keep the native run green. The dashboard separately shows **Known defects**, **CI-blocking issues**, **Investigate now**, slowest scenarios, flaky/retry debt and accepted-risk release state.

See `26-BUSINESS-REPORTING-STANDARD-2026.md` for the full industry benchmark and metric definitions.


## CI model

1. Install locked dependencies.
2. Install required Playwright browsers.
3. Run architecture/type/framework gates.
4. Run selected project in shards when appropriate.
5. Upload blob + project business bundles from each shard.
6. Merge once.
7. Validate the merged bundle.
8. Publish artifacts/dashboard.
9. Send at most one stakeholder notification after merge.

Do not send one email per shard.

Use CI secret stores for credentials. Azure pipeline and GitHub workflow in the repository are templates; teams should attach their own protected environments/service connections/Key Vault or repository/environment secrets.


## AI runtime reporting

When AI is actually invoked, the report records provider/model/status/latency metadata without storing prompts or secrets. The dashboard includes an **AI runtime audit** table and AI-call KPI. `report:business` includes the same provider/model evidence in the executive summary.

```text
reports/<project>/ai/ai-audit.jsonl
reports/<project>/business/business-report.json
reports/<project>/business/EXECUTIVE_SUMMARY.md
```

These are operational facts. They are kept separate from deterministic pass/fail and release-gate calculations.

## Test-authoring productivity report

Agent/MCP/CLI authoring sessions can be summarized with:

```bash
npm run authoring:report
```

Savings are calculated only when `AUTHORING_MANUAL_BASELINE_MINUTES` is explicitly set by the team.


## CI AI/healing variables

GitHub Actions and Azure Pipelines expose the same provider-neutral controls used locally:

```text
AI_ENABLED
HEALING_AI_ENABLED
HEALING_MODE
AI_PROVIDER_MODE
AI_PROVIDER / AI_PROVIDER_ORDER
AI_ALLOW_CLOUD_EGRESS
AI_AUDIT_ENABLED
AI_RUNTIME_LOGGING
<provider model + secret variables>
```

The framework-validation stage forces AI off so compile/architecture/security regression stays deterministic. The selected project-test stage may enable AI through protected CI variables/secrets.

## Semantic healing reporting

The business report distinguishes locator attempts from proven recovery:

- `validated` — post-condition passed; counts as **Self-healed** and may reuse a semantically validated cache entry
- `rejected` — candidate/action did not produce the intended state; visible in the audit but never counted as healed or cached
- `suggested` — candidate found while `HEALING_MODE=suggest`; no runtime action was taken
- `unverified` — runtime action completed without a semantic post-condition; retained for audit but not counted/cached

`business-report.json`, the HTML dashboard, merged shard reporting and the executive summary use the same rule. Historical pre-v1.2.2 records without an outcome are treated as validated for backward-compatible report reading, but legacy cache entries are not trusted for future execution.
