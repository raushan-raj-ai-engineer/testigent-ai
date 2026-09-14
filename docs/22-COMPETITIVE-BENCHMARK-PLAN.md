# Competitive Benchmark Plan

TestigentAI must not claim market leadership from a feature checklist. Comparative claims require reproducible evidence.

## Required benchmark suites

1. **Authoring:** requirement → approved executable test, measured in median engineer minutes.
2. **Scale:** 100/500/2,000 independent cases, measured by wall-clock, shard imbalance and worker utilization.
3. **Data safety:** intentional collision/adversarial datasets, measured by preflight detection and runtime collision count.
4. **Flakiness:** controlled locator/timing/environment defects, measured by correct diagnosis, safe healing and false-heal rate.
5. **RCA:** human-labelled failure corpus, measured by classification precision/recall and triage time.
6. **AI agents/RAG:** known-good/known-bad datasets, measured by evaluator calibration, cost and latency.
7. **Portability:** local + two remote/cloud providers with zero business-test rewrites.
8. **Security:** secrets, malicious declarative actions, unauthorized writes, provider egress policy and dependency vulnerability gates.
9. **Accessibility/visual:** measure useful regression detection while explicitly tracking false positives/false negatives.

## Evidence format

Every benchmark run should store:

- product/version and commit,
- hardware/cloud environment,
- project/environment/profile/lane,
- dataset/version,
- test selection,
- worker/shard configuration,
- raw machine-readable results,
- derived metrics,
- failures/exclusions,
- comparison methodology.

## Product decision rule

A capability graduates from *roadmap* to *competitive advantage* only when the benchmark is repeatable and the advantage holds across more than one representative application. Vendor marketing numbers may inform priorities but are not substitutes for TestigentAI-owned evidence.

## v1.8.0 executable benchmark mapping

v1.8.0 converts the highest-priority parts of this plan into executable, evidence-gated commands:

```bash
# Adoption/pilot measurements
APP=<app> ENV=<env> npm run qa:adoption -- record ...
APP=<app> ENV=<env> npm run qa:adoption -- report

# Baseline comparison
npm run benchmark:compare -- --input=<completed-comparative-dataset.json>

# Planner load diagnostics (not certification)
npm run benchmark:scale:plan:500
npm run benchmark:scale:plan:2000

# Measured execution evidence
npm run benchmark:scale:evaluate -- --input=<measured-scale-evidence.json>
```

The benchmark input is provenance-bound. Competitive differentiation requires multiple applications and non-synthetic raw evidence. The scale planner can exercise 2,000 independent planning items, but a 2,000-test product claim requires a measured 2,000-case execution record. See `docs/55-v1.8.0-ADOPTION-BENCHMARK-INTELLIGENCE.md` and `docs/57-v1.8.0-SCALE-CERTIFICATION.md`.
