# TestigentAI v1.6.0 Pre-Tag Verification Report

## Status

**Pre-tag release candidate.** `v1.5.3` remains the certified baseline until this v1.6.0 closure candidate passes replacement trusted-main CI, a trusted-main rerun proof, and the tag-triggered five-platform/browser compatibility matrix.

## Connected validation already proven

On macOS with Node.js `22.23.2`, the R3 pre-tag candidate passed the complete connected `npm run validate:final` chain:

- release static + LF/CRLF portability: PASS;
- architecture/framework health/scale/scenario/comment audits: PASS;
- reporting + rerun provenance contracts: PASS;
- TypeScript `tsc --noEmit`: PASS;
- review hardening: **40/40 PASS**;
- complete framework regression: **127/127 PASS**;
- security: **0 high/critical advisories**.

PR #12 and its full workflow rerun passed. Trusted-main then proved the fair AI retry implementation reached all configured attempts. A later failed-only rerun passed provider generation and the real AI healing lane, but exposed a final acquisition boundary: default artifact-download context did not surface required core shard artifacts to the resolver.

The resolver failed closed rather than publishing incomplete evidence.

## R4 closure in this package

This candidate keeps the strict R3 resolver and changes how merge evidence is acquired/retained:

1. technical blobs and business reports use authenticated workflow-run artifact lookup with `github-token`, `repository`, and `run-id`;
2. the AI audit uses the same authenticated workflow-run lookup;
3. artifact-name patterns remain restricted to the current `github.run_id` family;
4. application/environment/run/attempt/shard validation remains fail-closed in `ci:report:rerun:resolve`;
5. business and technical evidence must resolve from the same selected source attempt;
6. intermediate artifacts are retained whenever a required core/AI lane fails;
7. after a genuinely successful run, cleanup removes intermediate artifacts across the complete workflow-run attempt family.

No mutable `latest` pointer is used for release evidence.

## Packaging-environment evidence for R4

| Check | Result |
|---|---|
| Release static contract | PASS |
| LF/CRLF workflow portability | PASS |
| Offline release inventory | PASS |
| Synthetic mixed-attempt resolver contract | PASS |
| Workflow acquisition/retention regression contract | PASS |
| TypeScript/TSX syntax parse | PASS |
| JSON parsing | PASS |
| YAML parsing | PASS |
| Markdown local-link integrity | PASS |
| Trailing whitespace | PASS |
| Release manifest verification | PASS |
| Generated/cache/runtime artifact hygiene | PASS |

The packaging environment does not replace the connected Node 22 `npm ci` + Playwright/typecheck/framework/security gates. Those already passed for R3, and must be rerun after applying R4 because the workflow/contracts/docs changed.

## Remaining certification gates

After applying this exact candidate on a hotfix branch:

```bash
rm -rf node_modules
npm ci
npx playwright install chromium
npm run validate:final
```

Then require, in order:

1. hotfix PR CI green;
2. PR rerun green;
3. merge to `main`;
4. trusted-main core + AI + reporting all green;
5. trusted-main rerun green with `Resolve rerun-safe report provenance` passing;
6. only then create annotated tag `v1.6.0`;
7. Ubuntu Chromium/Firefox/WebKit, macOS WebKit, and Windows Chromium compatibility all green.

Until all seven are satisfied, documentation must not describe v1.6.0 as certified.
