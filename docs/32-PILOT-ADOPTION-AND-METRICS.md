# Pilot Adoption and Evidence Plan

The next product-readiness decision must be based on observed adoption and quality outcomes, not feature count. Use at least two representative applications and at least two engineers who did not implement the framework.

## Entry criteria

- `npm run validate:final` is green on the supported CI Node/browser matrix.
- A1–A8 architect-review regression gates are green.
- Pilot data is synthetic/non-sensitive unless the project's evidence/AI policy has been formally approved.
- Each application declares owner, environment, auth strategy, AI policy and evidence-retention policy.
- Existing tests are inventoried with `npm run qa:migrate -- <path>` before deciding what to refactor.

## Measurements

Record these per application and engineer without inventing target values before the pilot starts:

| Metric | Measurement rule |
| --- | --- |
| Time to first passing UI/API test | elapsed time from clean onboarding start to first stable CI pass |
| Requirement-to-approved-test time | median elapsed time from accepted requirement to approved source test |
| Migration friction | files/touchpoints required to move an existing Playwright scenario behind project layers |
| Clean-pass rate | clean business passes / executed business scenarios |
| Retry-pass rate | passes after retry / executed business scenarios |
| False-heal rate | recoveries that select the wrong business control or hide a seeded real defect / attempted healings |
| Seeded-defect masking | count of genuine seeded business failures converted to a clean pass; acceptance target is zero |
| Triage time | median time from CI failure to classified root cause/evidence location |
| Report completeness | required result/evidence fields present / expected fields |
| CI wall time and cost | same workload/profile, same runner class, with and without TestigentAI controls |
| AI usage/cost | calls, model/provider, tokens/cost when available, and purpose per approved run |
| Support burden | framework-specific questions/defects per engineer/week |

## Required comparison

Use the versioned scenarios in `docs/22-COMPETITIVE-BENCHMARK-PLAN.md`. Compare against plain Playwright using the same application state, assertions, browser, data and CI resources. Publish raw measurements, exclusions and framework version alongside any summary claim.

## Exit decision

A pilot can support broader rollout only when reliability/security gates stay green and the measured adoption/maintenance outcomes justify the operational cost. Commercial readiness additionally requires external customer evidence, authenticated authorization/tenant controls for a hosted product, and a repeatable support/upgrade model. Do not convert unmeasured capability into marketing claims.
