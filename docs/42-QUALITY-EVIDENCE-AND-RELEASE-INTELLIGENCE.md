# Quality Evidence and Release Intelligence — v1.6.0

## Goal

v1.6.0 moves TestigentAI from a framework that reports automation results toward a governed quality-decision platform. The design deliberately avoids opaque AI scoring. Release claims are deterministic, explainable and linked to the exact execution facts that support them.

## User experience

The main `Business Quality Dashboard` remains executive-first. It keeps the existing release gate, quality pass rate, quality failures, known defects, CI blockers, execution coverage, flaky signals and validated healing.

A new **Verify dashboard claims** action opens `evidence-ledger.html`. This is the audit-first view for people who want to challenge or verify a number without making the normal dashboard more complicated.

Generated business bundle:

```text
business/
├── index.html                 # simple stakeholder dashboard
├── business-report.json       # deterministic execution facts
├── business-tests.csv         # flat scenario export
├── evidence-ledger.html       # one-click claim verification
├── evidence-graph.json        # machine-readable provenance graph
├── assets/
└── evidence/                  # materialized safe attachments
```

## Evidence graph

`src/framework/analytics/evidence-graph.ts` derives a graph from final `ExecutionFacts` after report evidence has been materialized.

Node types:

- run
- claim
- requirement
- scenario
- source file
- attachment
- known defect
- validated healing record
- AI audit record

Relationships include `supports`, `derived-from`, `implements`, `evidenced-by`, `healed-by` and `affected-by`.

Requirement links are extracted only from explicit tags such as:

```text
@requirement:PAY-101
```

The graph does not invent requirement mappings.

## Claims currently exposed

The ledger explains these deterministic claims:

- release recommendation
- explainable release risk
- applicable execution coverage
- quality pass rate
- quality failures
- CI-blocking issues
- accepted known-defect debt
- semantically validated healing
- AI runtime calls
- scenario traceability completeness

If the reported scope is empty, the dashboard and ledger show **INSUFFICIENT EVIDENCE**, **UNKNOWN** risk and `N/A` rates rather than turning an empty denominator into a green signal.

Each claim contains:

- displayed value
- status (`SUPPORTED`, `ATTENTION`, `INCOMPLETE`)
- plain-language explanation
- calculation formula where applicable
- exact source fields
- supporting scenario IDs
- safe direct links to materialized scenario attachments when available

## Explainable release risk

Release risk is deliberately **score-free**.

```text
HIGH
  CI blockers or ATTENTION_REQUIRED gate

MEDIUM
  accepted known defects, flaky/retry recovery,
  rejected/unverified healing or other named debt

LOW
  no configured risk signal requires attention

UNKNOWN
  no reported scenario evidence exists, so risk is not inferred
```

Evidence confidence is:

```text
COMPLETE
  100% scenario traceability and 100% applicable execution coverage

PARTIAL
  otherwise
```

No hidden weighting, LLM score or probability is used.

## Truth boundary

The Evidence Ledger proves how TestigentAI calculated a displayed claim from captured execution facts. It does **not** prove:

- customer demand
- production correctness outside executed scope
- complete functional coverage
- absence of untested defects
- a zero false-heal rate

False-heal prevention is tested separately by the seeded safety benchmark described in `44-FALSE-HEAL-SAFETY-BENCHMARK.md`.

## Security and privacy

The ledger uses the already-sanitized/materialized business-report evidence. Attachment links are limited to safe relative report paths; absolute or parent-traversal paths are never rendered as links. It does not bypass the shared redaction, visual-evidence or retention policies introduced by the architect hardening release.

## Regression gates

The release fails if:

- the main dashboard no longer links to the ledger
- `evidence-graph.json` is not generated
- the evidence ledger loses its truth-boundary statement
- explainable release risk disappears
- evidence/impact regression tests are removed from architect hardening

See `tests/framework/evidence-intelligence-contract.spec.ts` and `scripts/reporting-contract.ts`.
