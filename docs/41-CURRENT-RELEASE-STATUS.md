# Current Certified Release Status

## Certified baseline: v1.7.0

**TestigentAI v1.7.0 — Agentic Test Intelligence is the current immutable certified baseline.**

| Item | Certified state |
| --- | --- |
| Release | `v1.7.0` |
| Tagged commit | `d9a228bc826e2bfaf4036535b61593ca25dad4b4` |
| Runtime | Node.js 22.x |
| Local final validation | PASS — 154 tests in the connected final validation |
| Main CI + full rerun | PASS |
| Main Release Compatibility | PASS 5/5 — run `34779238283` |
| Tag Release Compatibility | PASS 5/5 — run `34779586495` |
| Security policy | PASS — 0 high/critical advisories at certification |
| Agentic deterministic safety | PASS |
| Rerun-safe report provenance | PASS |

The `v1.7.0` tag is immutable and must not be moved or recreated. `v1.6.1` remains preserved as the previous certified baseline.

## Development candidate: v1.8.0

v1.8.0 consolidates the next priority architect-review items into one candidate:

- multi-application, multi-engineer Adoption & Pilot Intelligence;
- baseline-backed comparative benchmark evidence with commit/SHA-256 provenance;
- seeded false-heal measurement;
- synthetic 500/2,000 planning diagnostics separated from measured scale certification;
- measured 100/500/2,000-case scale evidence evaluation;
- deterministic OpenAPI response validation and breaking-change detection;
- adoption, benchmark/scale and API contract dashboard drill-downs;
- browser-neutral Product Intelligence deterministic safety;
- blocking GitHub/Azure/release-compatibility gates.

The v1.8.0 candidate is **not certified** until connected Node 22 validation, PR/main/rerun CI and Release Compatibility 5/5 complete on the applied repository. Pilot/benchmark claims additionally require real measured evidence; sparse or synthetic data remains `INSUFFICIENT_EVIDENCE`.

See:

- `docs/55-v1.8.0-ADOPTION-BENCHMARK-INTELLIGENCE.md`
- `docs/56-v1.8.0-API-CONTRACT-INTELLIGENCE.md`
- `docs/57-v1.8.0-SCALE-CERTIFICATION.md`
- `docs/58-v1.8.0-IMPLEMENTATION-AND-REVIEW-PLAN.md`
- `docs/59-v1.8.0-CANDIDATE-HANDOFF.md`

## Authoritative release workflow

```text
feature branch
 -> npm run validate:final
 -> PR checks + rerun
 -> merge to main
 -> main CI + rerun
 -> Release Compatibility 5/5
 -> annotated vX.Y.Z tag
 -> tag-triggered Release Compatibility 5/5
 -> certification record
```
