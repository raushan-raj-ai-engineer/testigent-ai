# TestigentAI v1.6.1 Candidate Verification Report

## Certified baseline

`v1.6.0` is certified and immutable. Annotated tag `v1.6.0` resolves to commit `4225e151fadcc85fd0a9861b385bda82bd1c96c0`. Release Compatibility run `34760349497` passed Ubuntu Chromium/Firefox/WebKit, macOS WebKit and Windows Chromium.

## v1.6.1 candidate scope

This candidate changes only AI operational reliability and reporting:

1. deterministic AI safety is a dedicated blocking job with no external-provider dependency;
2. live provider/generation/healing checks run as a non-blocking operational canary;
3. canary outcomes are recorded as HEALTHY, DEGRADED, MISCONFIGURED or SKIPPED;
4. provider-health history is environment-scoped, lock-protected, atomic and bounded;
5. the business dashboard remains compact and links one-click to `ai-provider-health.html`;
6. only HEALTHY live AI canary execution evidence is merged into business facts; degraded provider evidence remains operational only.

## Packaging-environment checks required before handoff

- release static + LF/CRLF portability;
- offline release inventory;
- TypeScript/TSX syntax parse;
- JSON/YAML parse;
- Markdown local-link integrity;
- trailing-whitespace/runtime-artifact hygiene;
- release manifest and SBOM regeneration;
- exact-ZIP extraction verification.

## Connected certification still required

The package must not be described as certified v1.6.1 until Node 22 `npm run validate:final`, PR CI, main CI, main rerun and the 5/5 compatibility matrix are green. Live-provider degradation may remain DEGRADED without invalidating deterministic release correctness, but the canary evidence must be present and truthful.

## Final packaging evidence

Before archive creation, the v1.6.1 candidate passed the dependency-independent release freeze:

| Check | Result |
| --- | --- |
| Package version | `1.6.1` |
| `release:static` | PASS |
| LF/CRLF portability | PASS |
| `release:offline` | PASS |
| TypeScript/TSX syntax | 254 files / 0 errors |
| JSON | 29 files / 0 errors |
| YAML | 7 files / 0 errors |
| Markdown local links | 36 / 0 broken |
| Trailing whitespace | 0 files |
| Provider-canary schema/status-coherence/selection probe | PASS |
| Missing provenance identity / missing expected canary | FAIL-CLOSED / PASS |
| Provider-health sanitization/truth-boundary probe | PASS |

The final archive is additionally re-extracted into a clean directory and the release/static/offline/parser/integrity checks are repeated before handoff. Full connected `npm ci`, `npm run validate:final`, PR/main/rerun CI and the five-platform/browser compatibility matrix remain required before v1.6.1 can replace certified v1.6.0.

---

# TestigentAI v1.6.1 — Certified Baseline

## Release Focus

AI Operational Reliability

## Certification Status

TestigentAI v1.6.1 has completed release certification successfully.

### CI Validation

- Main CI: PASS
- Main full rerun: PASS
- Framework Validation: PASS
- Execution Plan: PASS
- Project Tests - Shard 1: PASS
- Project Tests - Shard 2: PASS
- AI Deterministic Safety: PASS
- AI Live Provider Canary: PASS as operational/non-blocking lane
- Provider Health History: PASS
- Rerun-safe Report Provenance: PASS
- Final Business Bundle Validation: PASS

## AI Operational Reliability Proof

The live Gemini provider experienced external availability/rate-limit conditions during certification.

Observed operational conditions included:

- HTTP 503 UNAVAILABLE
- HTTP 429 RESOURCE_EXHAUSTED

TestigentAI correctly classified the live provider as DEGRADED without converting external provider instability into a deterministic release failure.

Deterministic AI safety remained the release correctness gate.

The provider-health artifact remained valid, was persisted in provider-health history, and was consumed successfully by report merging and final business-bundle validation.

## Release Compatibility Matrix

- Ubuntu / Chromium: PASS
- Ubuntu / Firefox: PASS
- Ubuntu / WebKit: PASS
- macOS / WebKit: PASS
- Windows / Chromium: PASS

## Final Result

TestigentAI v1.6.1 is the current CERTIFIED BASELINE.

The v1.6.1 Git tag is immutable and must not be moved or recreated.

TestigentAI v1.6.0 remains preserved as the previous certified baseline.

Future runtime development must continue on a new version or feature branch rather than modifying the certified v1.6.1 tag.

