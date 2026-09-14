# Current Certified Release Status

## Current certified release: v1.9.0

**TestigentAI v1.9.0 — Failure Intelligence & Customer Showcase is the current immutable certified release at `6a32718353022da4e5ce51dace59e29692340913`.**

| Item | Certified state |
| --- | --- |
| Release | `v1.8.0` |
| Tagged commit | `1ad48d67661df02f51e5b6268a3f0d74bf2a182d` |
| Runtime | Node.js 22.x |
| PR CI + full rerun | PASS — run `34784647923`, attempt 2 |
| Main CI + full rerun | PASS — run `34800608332`, attempt 2 |
| Main Release Compatibility | PASS 5/5 — run `34801102017` |
| Tag Release Compatibility | PASS 5/5 — run `34801403186` |
| Exact SHA proof | Local main = main CI = compatibility = certified tag commit |
| Post-release documentation main | `6090b702a56078a546cfe6dd0d2bc2cbaba92dd6` |
| Post-release docs CI | PASS — run `34802423931` |

The `v1.8.0` tag is immutable and must not be moved or recreated. Post-release documentation commits on `main` do not change the certified v1.8.0 source snapshot.

## v1.9.0 certification evidence

v1.9.0 is the final planned reporting-focused feature release before the reporting surface is frozen. It consolidates:

- deterministic Failure Intelligence and root-cause taxonomy;
- stable incident fingerprints and common-cause clustering;
- explicit `UNKNOWN` behavior when evidence is insufficient;
- live-only immutable failure-history trust boundary;
- 10 realistic customer-showcase scenarios with `SHOWCASE`, `synthetic=true`, `claimEligible=false`;
- one-click populated showcase for Failure, Adoption, Benchmark, Scale, API Contract, Healing and Agentic/MCP signals;
- read-only MCP failure explanation/triage tools;
- npm Bulk Advisory security fallback when `npm audit` cannot produce vulnerability evidence;
- executable reporting-freeze policy.

v1.9.0 certification is complete. Main CI run `34808556321` and its rerun passed; fresh main Release Compatibility `34809207686` passed 5/5; annotated tag `v1.9.0` resolves to `6a32718353022da4e5ce51dace59e29692340913`; and tag-triggered Release Compatibility `34809446255` passed 5/5.

Showcase metrics are never adoption, differentiation, scale, release or customer claims. Real evidence paths remain unchanged and fail closed when provenance is insufficient.

See:

- `docs/60-v1.9.0-FAILURE-INTELLIGENCE.md`
- `docs/61-v1.9.0-CUSTOMER-SHOWCASE.md`
- `docs/62-v1.9.0-REVIEW-AND-RELEASE-PLAN.md`
- `docs/63-REPORTING-FREEZE.md`
- `docs/64-v1.9.0-CANDIDATE-HANDOFF.md`

## Authoritative release workflow

```text
feature branch
 -> npm run validate:final
 -> PR checks + full rerun
 -> merge to main
 -> main CI + full rerun
 -> Release Compatibility 5/5
 -> verify exact SHA across local/main CI/compatibility
 -> annotated vX.Y.Z tag
 -> tag-triggered Release Compatibility 5/5
 -> GitHub Release
 -> post-release docs sync without moving the tag
```
