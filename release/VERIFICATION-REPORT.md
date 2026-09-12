# TestigentAI v1.4.2 Verification Report

## Scope

v1.4.2 is a focused compatibility/isolation patch on top of the validated v1.4.1 architecture. It preserves the portfolio, reporting, agent-authoring, auth and healing contracts while closing a cross-project database-capability leak and hardening the dormant demo UI/API/DB reference scenario.

## Architecture review outcomes

- **Reusable core remains project-neutral.** Application selectors, endpoint contracts, schema knowledge and business workflows remain under `projects/<project>`.
- **AI is optional and lazy.** A healthy primary locator, deterministic fallback or validated cache path does not initialize an AI provider.
- **Runtime healing is deliberately narrow.** UI locator recovery may use deterministic and AI-assisted recovery only after semantic validation. Authentication has its own recovery lifecycle. API and database business-contract/schema mismatches are diagnosed or proposed for source maintenance rather than silently rewritten.
- **One governed authoring lifecycle.** Existing requirement intelligence and proposal review now cover UI, API, database and mixed E2E automation. Generated code remains review-blocked until a human approves it.
- **Database safety defaults to read-only.** Agent-generated DB validation cannot be promoted with mutating/destructive SQL.
- **Business reporting remains the primary stakeholder view.** The new portfolio dashboard aggregates estate health while per-project reports remain the engineering drill-down source.
- **Complexity is intentionally bounded.** No second agent framework and no nested cross-project local concurrency layer were introduced.

- **Database capability ownership is project-scoped.** `projects/<project>/config/<env>.json` exclusively selects `none|postgres|mysql|mssql`; machine/repository `DB_TYPE` values cannot activate another project's `@db` scenarios.
- **Cross-layer samples must establish UI state explicitly.** The demo UI/API/DB reference journey opens the application before UI interaction instead of relying on prior page state.

## Evidence executed in the packaging environment

| Check | Result |
|---|---|
| Release static contract | PASS — 353 files inspected |
| Offline release inventory | PASS — 28 JSON, 345 text, 18 required artifacts |
| Architecture boundary check | PASS — demo + sdet-practice, 0 issues |
| Reusable export documentation audit | PASS — 188 declarations, 0 issues |
| TypeScript/TSX syntax transpilation | PASS — 242 files, 0 syntax errors |
| JSON parsing | PASS — 28 files |
| YAML parsing | PASS — 6 files |
| Shell syntax | PASS |
| Markdown local-link integrity | PASS — 47 Markdown files |
| Multi-project dynamic dry-run | PASS — demo/qa + sdet-practice/qa discovered |
| Portfolio summary + HTML dashboard generation | PASS |
| Business dashboard accepted-risk semantics | PASS |
| AI-inclusive portfolio missing-config preflight | PASS — fails before project execution with actionable error |
| Generated API proposal boundary guard | PASS — direct `APIRequestContext` proposal blocked |
| Generated database safety guard | PASS — mutating SQL proposal blocked |
| Project-scoped database isolation contract | PASS — shared `DB_TYPE` cannot activate a `database.type=none` project |
| Demo cross-layer navigation hardening | PASS — UI journey explicitly opens application before interaction |

## Tests included for dependency-backed execution

The release includes framework regression coverage for:

- lazy AI gateway creation after deterministic UI recovery is exhausted;
- business portfolio reporting;
- generated API/domain-service boundaries;
- generated database read-only safety;
- existing multi-project selection/discovery contracts;
- existing proposal ownership/approval/promotion behavior.

These tests run through the normal dependency-backed framework suite on the consumer Mac/CI.

## Environment-limited checks

The isolated packaging environment could not complete `npm ci` because dependency retrieval timed out. Consequently:

- full `npm run validate:final` was **not claimed as passed** in the packaging environment;
- `scale:audit` could not execute there because the partial environment lacked `csv-parse`;
- `security:check` could not complete because `npm audit` could not reach the npm registry.

These are environment limitations, not substituted successes. They remain mandatory consumer Mac/CI certification gates.

## Consumer Mac / CI certification

```bash
npm ci
npx playwright install chromium
npm run validate:final
npm run test:projects -- --all --env=qa --dry-run --project=chromium
npm run test:projects -- --all --env=qa --project=chromium
```

For an AI-inclusive portfolio run, configure an approved provider/model/key through local/CI secrets and then run:

```bash
AI_ENABLED=true \
AI_PROVIDER_MODE=single \
AI_PROVIDER=<approved-provider> \
HEALING_AI_ENABLED=true \
npm run test:projects -- --all --env=qa --include-ai --project=chromium
```

Cloud providers additionally require the explicit cloud-egress policy setting documented in `.env.example`. Never place provider secrets in source-controlled files.
