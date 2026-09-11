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
