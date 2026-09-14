# Current Certified Release Status

## Current certified release: v1.9.1

**TestigentAI v1.9.1 — Corrective Hardening is the current immutable certified release at `38e2406c73608cabcf42a8ff0ea8e35e745dea23`.**

| Item | Certified state |
| --- | --- |
| Release | `v1.9.0` |
| Tagged commit | `6a32718353022da4e5ce51dace59e29692340913` |
| Runtime | Node.js 22.x |
| Main CI + full rerun | PASS — run `34808556321` |
| Main Release Compatibility | PASS 5/5 — run `34809207686` |
| Tag Release Compatibility | PASS 5/5 — run `34809446255` |
| Exact SHA proof | Local main = main CI = compatibility = certified tag commit |
| Post-release documentation main | `cc4350319b2f37c0f645744478f715504ecc1264` |
| Post-release docs CI | PASS — run `34810348016` |

The `v1.9.0` tag is immutable and must not be moved or recreated. Post-release documentation commits on `main` do not change the certified v1.9.0 source snapshot.

## Corrective review candidate: v1.9.1

v1.9.1 is a hardening-only candidate created from the post-release v1.9.0 main line. It closes the independent architecture/product review findings R01–R14. The work is corrective security/correctness/compatibility hardening allowed by the active reporting freeze; it does not add new reporting features.

Key areas: fail-closed OpenAPI validation and cycle-safe compatibility detection; verified DB TLS; canonical project boundaries; UNVERIFIED-by-default MCP evidence; complete output redaction; abstaining triage; cause-aware clusters; occurrence history; SQL/CSV safety; MCP lifecycle/budgets; incremental evidence stores; immutable GitHub Action pins.

v1.9.1 is **not certified** until clean Node 22 dependency installation, typecheck, the R01–R14 closure suite, full `validate:final`, PR/main reruns and the 5/5 main/tag Release Compatibility chain pass.

See `docs/65-v1.9.1-INDEPENDENT-REVIEW-CLOSURE.md`.

## Authoritative release workflow

```text
feature branch
 -> npm ci && npm run validate:final
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

## v1.9.1 certification evidence

v1.9.1 certification is complete.

- Certified SHA: `38e2406c73608cabcf42a8ff0ea8e35e745dea23`
- Main CI: `34818484552` — PASS
- Main Release Compatibility: `34818923701` — 5/5 PASS
- Tag-triggered Release Compatibility: `34819277626` — 5/5 PASS
- Framework regression: 201/201 PASS
- Independent review closure: 14/14 PASS
- Security: 0 high/critical advisories
- GitHub Release: published

Historical certified release `v1.9.0` remains immutable at `6a32718353022da4e5ce51dace59e29692340913`.

