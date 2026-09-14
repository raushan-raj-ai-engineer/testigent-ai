# TestigentAI v1.9.0 Certified Verification Report

## Certification result

`v1.8.0 — Evidence-Backed Product Intelligence` is the immutable certified source baseline at:

```text
1ad48d67661df02f51e5b6268a3f0d74bf2a182d
```

The current post-release documentation main used as the upgrade ancestry boundary is:

```text
6090b702a56078a546cfe6dd0d2bc2cbaba92dd6
```

v1.8 certification evidence already completed PR/main reruns plus main and tag-triggered Release Compatibility 5/5. The v1.8.0 tag must not be moved or recreated.

## v1.9.0 certified scope

1. deterministic evidence-first Failure Intelligence taxonomy;
2. stable normalized SHA-256-derived failure fingerprints and common-cause clustering;
3. fail-honest `UNKNOWN` when evidence is insufficient;
4. bounded, immutable, concurrent-writer-safe live failure history;
5. secret/PII sanitization before failure signatures are persisted or returned;
6. governed read-only MCP failure explanation and triage;
7. 10 realistic isolated customer-showcase scenarios;
8. one-click populated showcase for Failure, Adoption, Benchmark, Scale, API Contract, Healing and Agentic/MCP behavior;
9. hard `SHOWCASE` / `synthetic=true` / `claimEligible=false` trust boundary;
10. synthetic scale showcase remains `measured=false`;
11. npm Bulk Advisory fail-closed fallback retained after the legacy quick-audit endpoint retirement;
12. blocking Failure Intelligence deterministic safety in GitHub Actions, Azure Pipelines and Release Compatibility;
13. reporting-surface feature freeze after v1.9 certification, except governed corrective work.

## Upgrade safety

`APPLY_UPGRADE.sh` refuses `main`/`master`, dirty worktrees by default, incorrect versions, a moved/recreated v1.8.0 tag, and branches that do not descend from the v1.8 post-release main boundary.

The overlay preserves authoritative historical/concurrency files from the target repository and verifies their SHA-256 digests are unchanged before and after applying the bundle. This prevents a full candidate ZIP from accidentally regressing previously certified v1.7/v1.8 hardening.

## Showcase truth boundary

The customer showcase exists only to make the product understandable before a customer has accumulated real evidence. It is not customer execution evidence and cannot certify adoption, differentiation, scale, productivity, healing rate, release readiness or product-market claims.

Every bundled scenario is `SHOWCASE`, synthetic and non-claimable. The validator rejects claim-eligible showcase data and rejects synthetic scale data marked as measured.

## Packaging-environment validation executed

The final packaging environment completed these dependency-independent checks after all v1.9 source changes:

- release static contract: PASS;
- LF/CRLF release portability contract via `release:static`: included in connected gate and statically retained;
- offline release inventory: PASS;
- reusable-export comment audit: 266 declarations, 0 issues;
- bash syntax for `APPLY_UPGRADE.sh` and `VERIFY_UPGRADE.sh`: PASS;
- semantic TypeScript diagnostics over all v1.9-modified TS files, excluding only diagnostics caused by unavailable external/Node typings in this isolated environment: 0 product-code diagnostics;
- TypeScript transpilation of the showcase dependency graph: PASS;
- executable showcase validation: 10 scenarios, 9 unique incidents, 1 intentional `UNKNOWN`, `claimEligible=false`: PASS;
- one-click showcase HTML/JSON generation: PASS;
- npm Bulk Advisory payload/normalization and malformed-advisory fail-closed behavior: PASS;
- v1.9 static CI/Azure/Release Compatibility gate contracts: PASS.

The packaging container could not complete `npm ci` because registry access did not complete and its npm cache lacked all locked packages. Therefore this report does **not** claim connected dependency installation, full Playwright regression, live registry security query or browser execution from the packaging environment.

## Connected validation required after applying to the user's repository

From a clean feature branch created from current `main`:

```bash
npm ci
npm run typecheck
npm run showcase:validate
npm run test:failure-intelligence
npm run validate:final
npm run release:sbom
npm run release:manifest
npm run release:offline
npm run security:check
```

Then require PR CI + full rerun, merge to main, main CI + full rerun, fresh Release Compatibility 5/5, exact-SHA equality, annotated `v1.9.0` tag, and tag-triggered Release Compatibility 5/5 before publishing a GitHub Release.

## Candidate rule

v1.9.0 is **certified** at `6a32718353022da4e5ce51dace59e29692340913`. Main CI `34808556321` and its rerun passed, main Release Compatibility `34809207686` passed 5/5, and tag-triggered Release Compatibility `34809446255` passed 5/5. The reporting surface is now feature-frozen; later reporting changes are limited to approved bug/security/accessibility/compatibility/performance corrections unless a new architecture review explicitly reopens the surface.
