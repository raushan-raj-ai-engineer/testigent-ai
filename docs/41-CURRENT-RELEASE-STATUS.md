# Current Certified Release Status

## Current certified release: v1.9.1

**TestigentAI v1.9.1 — Corrective Hardening is the current immutable certified release at `38e2406c73608cabcf42a8ff0ea8e35e745dea23`.**

| Item | Certified state |
| --- | --- |
| Release | `v1.9.1` |
| Tagged commit | `38e2406c73608cabcf42a8ff0ea8e35e745dea23` |
| Runtime | Node.js 22.x |
| Main CI | PASS — run `34818484552` |
| Main Release Compatibility | PASS 5/5 — run `34818923701` |
| Tag Release Compatibility | PASS 5/5 — run `34819277626` |
| Full framework regression before certification | PASS — 201/201 |
| Independent v1.9.0 review closure suite | PASS — 14/14 |
| Security before certification | PASS — 0 high/critical |
| Post-release documentation main | `bcfa7d8905b51ba66673478e43eab3c5ea4f9fdc` |
| Post-release docs CI | PASS — run `34826308673` |

The `v1.9.1` tag is immutable and must not be moved or recreated. Post-release documentation commits on `main` do not change the certified v1.9.1 source snapshot. Historical `v1.9.0` remains immutable at `6a32718353022da4e5ce51dace59e29692340913`.

## Corrective re-review candidate: v1.9.2

v1.9.2 is a hardening-only candidate based on the immutable v1.9.1 source snapshot. It responds to the independent v1.9.1 re-review without reopening the reporting feature surface.

The candidate closes the re-review's remaining production-contract cases across:

- selected-project canonical/symlink containment and promotion revalidation;
- OpenAPI 3.1 boolean schemas, null/enum handling and conjunctive `$ref` sibling semantics;
- directional API compatibility, parameter case semantics and explicit incomplete-comparison results;
- idempotent report/evidence regeneration without history conflicts;
- provenance-safe failure classification that does not upgrade legacy heuristics into structured evidence;
- PostgreSQL native parameters/JSON operators and SQL Server bracket identifiers;
- strict TLS encryption policy and SSL-mode validation;
- MCP lifecycle, active cancellation and pre-newline frame budgeting;
- spreadsheet-viewer CSV qualification.

Packaging-environment validation is recorded in `docs/68-v1.9.2-VALIDATION-HANDOFF.md`. This archive is **not a certified v1.9.2 release**. Connected Node 22 dependency installation, full typecheck/regression/security gates and the normal PR/main/5-of-5 compatibility chain remain mandatory before any v1.9.2 tag is created.

## Authoritative release workflow

```text
feature branch
 -> npm ci && npm run validate:final
 -> npm run release:csv-viewer
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
