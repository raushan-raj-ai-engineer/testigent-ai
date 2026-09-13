# Explainable Change Impact and Incremental Migration — v1.6.0

## Change-impact goal

`npm run qa:impact` recommends which project tests are affected by a change and explains every selection reason.

The v1.6.0 implementation is intentionally **advisory**. It does not silently narrow normal CI execution. This protects teams from false-negative impact selection while they collect benchmark evidence on their own codebases.

## Commands

Compare Git refs:

```bash
npm run qa:impact -- --base main --head HEAD
```

Analyze an explicit list:

```bash
npm run qa:impact -- --files projects/demo/src/pages/todo.page.ts,projects/demo/src/api/user.api.ts
```

The output is run-scoped under:

```text
reports/<app>/<env>/<RUN_ID>/change-impact/
├── change-impact.json
└── change-impact.md
```

## Selection evidence

For the selected application, TestigentAI builds a relative-import dependency graph across project TypeScript/TSX files.

A test is recommended when:

- the test itself changed
- a transitive relative dependency changed
- a conservative feature-ownership hint from project file/test naming matches
- an explicitly tagged requirement file changed
- a shared framework/config file changed

Shared framework/config changes deliberately select **all tests for the chosen project**. That is a fail-safe choice, not an optimization failure.

If a project-owned changed file cannot be mapped to any test by these signals, TestigentAI fails safe to **all project tests** and records `unresolved project change` as the reason. It never turns a mapping gap into a recommendation to skip the suite.

Every selected test records one or more reasons. Example:

```text
projects/demo/tests/ui/todo.spec.ts
  reason: dependency changed: projects/demo/src/pages/todo.page.ts
```

## Requirement traceability

Tests can expose explicit requirement links with:

```text
@requirement:PAY-101
```

Requirement-file impact never guesses semantic equivalence. If the repository does not contain an explicit mapping, the report says so.

## Known limitations

Feature-ownership hints are explainable heuristics and may intentionally over-select; the reason is recorded per test. Generic filename tokens such as `data`, `helper`, `shared`, `support`, `mapped`, `config` and similar framework vocabulary are excluded from ownership hints so they cannot create a narrow recommendation by accident. Heuristics are never treated as proof that non-selected tests are safe to skip.

Static import analysis cannot guarantee visibility into:

- dynamic imports
- runtime route/config changes
- remote service behavior
- shared systems changed outside the repository

Therefore v1.6.0 does not automatically replace regression execution with the impacted subset.

## Existing Playwright migration

`npm run qa:migrate -- [path]` remains an adoption aid rather than a bulk rewrite tool.

v1.6.0 adds deterministic migration slices:

1. **UI ownership** — raw selectors/navigation into project pages/workflows.
2. **Service and data ownership** — direct API/DB access into project clients/repositories.
3. **Governed recovery and AI** — direct healer/AI framework access into approved boundaries.

The assessment is run-scoped and generates:

```text
reports/<app>/<env>/<RUN_ID>/migration/
├── migration-assessment.json
└── migration-assessment.md
```

The migration tool preserves working assertions and recommends incremental slices. It does not automatically rewrite a customer suite.
