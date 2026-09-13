# TestigentAI v1.7.0 Candidate Verification Report

## Certified baseline

`v1.6.1` is the current certified and immutable baseline. The annotated release tag points at commit `5c2c785` (the v1.6.1 AI-canary outcome-normalization hotfix merge). Certification proved:

- main CI PASS;
- full main rerun PASS;
- deterministic AI safety PASS;
- live-provider degradation classified operationally without rewriting release correctness;
- provider-health history and rerun-safe report provenance PASS;
- final business bundle validation PASS;
- Release Compatibility 5/5: Ubuntu Chromium, Ubuntu Firefox, Ubuntu WebKit, macOS WebKit and Windows Chromium.

The previous `v1.6.0` certified tag remains immutable historical evidence.

## v1.7.0 candidate scope

v1.7.0 introduces Agentic Test Intelligence while preserving the v1.6.1 release truth boundary:

1. deterministic agentic trust contracts and explicit operational states;
2. requirement-to-plan and deterministic change-impact planning;
3. proposal-only generation with duplicate/project-boundary controls;
4. deterministic generated-source review with mandatory human-approval boundary;
5. immutable, run-scoped, sanitized Agent Decision Ledger;
6. governed read/review-oriented TestigentAI MCP server;
7. one-click `agentic-intelligence.html` reporting without altering deterministic business facts;
8. blocking Agentic Deterministic Safety gates in GitHub Actions and Azure Pipelines;
9. agentic deterministic safety included in the release compatibility matrix;
10. certified v1.6.1 live-canary runtime-path and GitHub outcome-normalization fixes retained.

## Packaging-environment evidence

The standalone candidate package was assembled in an offline packaging environment. Dependency-independent checks executed successfully:

| Check | Result |
| --- | --- |
| Package version | `1.7.0` |
| Release static contract | PASS |
| Offline release inventory / secret scan | PASS |
| Architecture boundary check | PASS |
| Reusable export JSDoc audit | 233 declarations / 0 issues |
| GitHub/Azure YAML parse | PASS |
| New v1.7 TypeScript syntax parse | PASS |
| New v1.7 semantic compile diagnostics | 0 candidate-file errors under external-module stubs |
| Core executable agentic self-check | PASS |
| Proposal-only generation proof | PASS |
| Reviewer raw-Playwright / cross-project rejection | PASS |
| Immutable/redacted decision ledger | PASS |
| MCP traversal denial | PASS |

`npm ci`, Playwright-backed deterministic contract execution and the full repository `npm run validate:final` require the connected Node 22 environment and are intentionally not claimed by this offline package build.

## Connected validation required before merge/certification

Run from the extracted candidate on Node 22:

```bash
npm ci
npx playwright install --with-deps chromium
npm run validate:final
npm run test:agentic:deterministic
npm run release:sbom
npm run release:manifest
npm run release:offline
npm run security:check
```

Then require:

- PR CI PASS and full PR rerun PASS;
- main CI PASS and full main rerun PASS;
- Agentic Deterministic Safety PASS;
- deterministic AI safety PASS;
- live-provider canary remains operational/non-blocking;
- report merge/final business bundle PASS;
- Release Compatibility 5/5 PASS.

## Certification rule

This ZIP is a **v1.7.0 development candidate**, not a certified release. Do not create or move a `v1.7.0` tag until connected validation, PR/main reruns and all five compatibility lanes pass. Never move/recreate the certified `v1.6.1` tag.

## Connected feature-branch validation

The final v1.7.0 feature-branch candidate completed connected validation successfully.

Evidence:

- `npm run validate:final`: PASS;
- framework critical suite: **154 passed**;
- dashboard concurrency stress: **30/30 passed**;
- Agent Decision Ledger contract: **4/4 passed**;
- Agent Decision Ledger multi-process stress: **20/20 passed**;
- SBOM generation: PASS with **149 components**;
- release manifest generation: PASS;
- offline release verification: PASS;
- security policy: PASS with **0 high/critical advisories**;
- `git diff --check`: PASS.

The connected review also closed two concurrency risks:

1. dashboard HTTP-test teardown now releases the Playwright page before shutting down its local server and terminates test-owned keep-alive connections;
2. Agent Decision Ledger concurrent writers are serialized and its JSONL view is published atomically with real child-process regression coverage.

This evidence does not constitute release certification. PR/main reruns and the full 5/5 Release Compatibility matrix remain mandatory.
