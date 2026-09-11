# V6 Data-Driven & Parallel Execution

## Core rule

**One independently reportable data case should create one Playwright test.** Do not loop 2,000 mutable cases inside one `test()` body.

```ts
const cases = DataFactory.loadCasesSync<LoginCase>('projects/demo/data/cases/login-cases.json');

for (const row of cases) {
  test(`${row.caseId} login`, { tag: ['@data', '@lane:api'] }, async ({ dataScope }) => {
    // row is one test; Playwright can shard/retry/report it independently.
    const userId = dataScope.stable('user');
  });
}
```

## Why this scales better

- Test-level sharding can distribute cases across CI shards.
- Retries rerun the individual failing row instead of the whole dataset.
- Reports retain the case ID and exact failure.
- `dataScope` prevents workers from mutating the same business identity.
- Duplicate `caseId` values fail before execution.

## Data formats

`DataFactory` supports JSON, CSV, YAML and Excel. Use format by data shape, not preference:

- JSON — nested API/business objects.
- CSV — large flat matrices.
- YAML — readable structured scenarios.
- Excel — business-maintained tabular cases.

## Identity lifecycles

- `stable(name)` — same identity across retries inside the same run; useful when retry must re-read the originally-created resource.
- `attempt(name)` — includes retry/parallel attempt identity; useful for mutation isolation.
- `idempotent(name)` — stable across runs for intentionally idempotent ownership/use cases.

Do not use idempotent IDs for tests that require a new entity on every run.

## Parallel execution

Default execution is Playwright-native. `PW_WORKERS` accepts an integer or percentage such as `50%`.

```bash
APP=demo ENV=qa TEST_PROFILE=regression PW_WORKERS=50% npm run test:project -- --project=chromium
```

CI sharding stays native:

```bash
APP=demo ENV=qa npm run test:project -- --project=chromium --shard=1/4
```

Duration-aware planning is optional:

```bash
APP=demo ENV=qa npm run execution:plan-duration -- --shards=4
```

It uses historical durations to build test lists. Because Playwright documents test-list execution as best-effort for some features, this is **opt-in**; native `--shard=x/y` remains the safe default.

## Shared resources

Prefer unique data. If a truly shared external resource cannot be partitioned, use Playwright's named lock mechanism around the smallest critical section rather than disabling parallelism for the entire suite.

## Scale review checklist

1. Every mutable entity has a test/worker/run owner.
2. Case IDs are unique and validated before browser startup.
3. Tests do not depend on execution order.
4. Cleanup can identify ownership and is retry-safe.
5. DB/API tests do not require browser authentication unless their capability actually needs it.
6. Reports preserve project, environment, run, test and case identity.
7. Sharding uses Playwright primitives first; custom scheduling is opt-in and measurable.

## Final release hardening

- Declare `caseId` in the Playwright test options/annotation at test definition time. Adding it inside the test body is too late for fixtures that create `dataScope`.
- `dataScope` identities include application, environment, Playwright `testId`, optional `caseId`, run/retry/parallel index according to lifecycle mode. This avoids QA/UAT and cross-test collisions even when business case IDs are reused.
- The governed `test:project` runner merges user `--grep` with required profile/lane filters and merges user `--grep-invert` with mandatory exclusions. CLI convenience cannot re-enable AI/manual/generated suites denied by policy.
- Optional duration-history balancing validates every estimate before planning. Native Playwright sharding remains the safe default.
