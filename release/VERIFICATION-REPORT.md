# TestigentAI v1.9.1 — Certified Verification Report

## v1.9.1 certified result

TestigentAI v1.9.1 is certified at `38e2406c73608cabcf42a8ff0ea8e35e745dea23`.

- Main CI `34818484552` — PASS
- Main Release Compatibility `34818923701` — 5/5 PASS
- Tag-triggered Release Compatibility `34819277626` — 5/5 PASS
- Full framework regression — 201/201 PASS
- Independent review closure — 14/14 PASS
- Security — 0 high/critical advisories
- Customer Showcase remains synthetic and non-claimable
- Reporting feature freeze remains active

The previous `v1.9.0` certified tag remains immutable at `6a32718353022da4e5ce51dace59e29692340913`.


## Certified baseline

`v1.9.0` is the current immutable certified release at `6a32718353022da4e5ce51dace59e29692340913`. Its main Release Compatibility `34809207686` and tag-triggered Release Compatibility `34809446255` passed 5/5. Post-release documentation main is `cc4350319b2f37c0f645744478f715504ecc1264` with CI `34810348016` green.

## v1.9.1 corrective scope

This candidate closes the 14 findings from the independent v1.9.0 architecture/product review. The detailed finding-to-fix map and acceptance coverage are in `docs/65-v1.9.1-INDEPENDENT-REVIEW-CLOSURE.md`.

Packaging-environment checks in this artifact are dependency-independent unless explicitly stated. A clean connected Node 22 `npm ci && npm run validate:final` is mandatory before certification.

## Upgrade safety

`APPLY_UPGRADE.sh` refuses `main`/`master`, dirty worktrees by default, incorrect versions, a moved/recreated v1.8.0 tag, and branches that do not descend from the certified v1.9.0/post-release documentation boundary.

The overlay preserves authoritative historical/concurrency files from the target repository and verifies their SHA-256 digests are unchanged before and after applying the bundle. This prevents a full candidate ZIP from accidentally regressing previously certified historical hardening while allowing the explicit v1.9.1 corrective files to change.

## Showcase truth boundary

The customer showcase exists only to make the product understandable before a customer has accumulated real evidence. It is not customer execution evidence and cannot certify adoption, differentiation, scale, productivity, healing rate, release readiness or product-market claims.

Every bundled scenario is `SHOWCASE`, synthetic and non-claimable. The validator rejects claim-eligible showcase data and rejects synthetic scale data marked as measured.

## Packaging-environment validation executed

See `docs/66-v1.9.1-REVIEW-VALIDATION.md` for the exact packaging-environment evidence and limitations. The final dependency-independent checks include static/offline release gates, 0 TypeScript syntax diagnostics, 279/279 reusable-export documentation contracts, a 14/14 executable R01–R14 counterexample probe, R13 replay-repair verification, and 0 hardening-scope semantic TypeScript errors after excluding only unavailable external package declarations.

The packaging environment could not complete `npm ci` because registry/DNS access was unavailable. Therefore this report does **not** claim a fresh full Playwright regression, live database matrix, browser matrix, or live registry security query from the packaging environment. Those connected gates remain mandatory before v1.9.1 certification.

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

Then require PR CI + full rerun, merge to main, main CI + full rerun, fresh Release Compatibility 5/5, exact-SHA equality, annotated `v1.9.1` tag, and tag-triggered Release Compatibility 5/5 before publishing a v1.9.1 GitHub Release.

## Candidate rule

This ZIP is a **v1.9.1 corrective hardening candidate**, not a certified replacement for v1.9.0. It must be applied and connected-certified without weakening existing gates. The reporting surface is feature-frozen after v1.9.0 certification; later reporting changes are limited to approved bug/security/accessibility/compatibility/performance corrections unless a new architecture review explicitly reopens the surface.
