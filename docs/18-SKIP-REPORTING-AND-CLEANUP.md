# Skip Reporting and Safe Cleanup

## Reporting improvement

The business dashboard now separates **execution coverage** from **test outcome** and explains intentional skips.

New deterministic facts:

- `executed` = passed + failed
- `executionRate` = executed / included scenarios
- `executedPassRate` = passed / executed scenarios
- `skipBreakdown` = categorized skipped/fixme scenarios

Skip categories:

- `DATABASE_NOT_CONFIGURED`
- `HUMAN_REVIEW_PENDING`
- `OPTIONAL_DEMO_DISABLED`
- `AUTH_NOT_CONFIGURED`
- `DEPENDENCY_NOT_CONFIGURED`
- `OTHER`

Each skipped scenario retains the Playwright annotation description where available. The merged business JSON and CSV preserve skip category/reason, so CI shard merging does not lose this context.

The dashboard adds a **Skip Breakdown** section and shows skip details inside each skipped scenario.

## Cleanup policy

Run a dry review first:

```bash
npm run clean:review
```

This deletes nothing.

Safe ephemeral cleanup:

```bash
npm run clean:runtime
```

This removes only regenerable outputs such as reports, test-results, merged CI working folders, coverage, dist and `.runtime`.

The cleanup tool deliberately does **not** auto-delete:

- `.auth`
- `.healing`
- `.report-history`
- `.application-knowledge`
- `.proposal-backups`
- `node_modules`
- tool/agent folders or legacy candidates

Those may contain useful state, history, credentials, learned knowledge, or developer tooling and therefore require human review.

## Recommended release cleanup

Before creating a release ZIP:

```bash
npm run clean:review
npm run clean:runtime
npm run validate:final
```

Do not include local `.env`, authentication state, reports, test results, caches, backup folders or `node_modules` in a release artifact.
