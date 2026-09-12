# TestigentAI v1.5.0 — Architect Review Closure

This release treats the 12 September 2026 v1.4.2 architect/product-owner review as a regression backlog, not as a checklist to silence. The goal is to remove the root causes behind A1–A8 while preserving project isolation, reporting semantics, deterministic-first recovery, auth lifecycle and multi-project execution.

## Closure matrix

| Review item | Root-cause correction | Permanent regression evidence |
| --- | --- | --- |
| A1 sensitive data survives redaction | One shared structured/free-text/URL sanitizer; sanitize-before-truncate API/healing evidence; explicit outbound AI fields; governed visual capture policy | `review-hardening-contract.spec.ts` canary probes + API evidence probe; secure screenshot policy |
| A2 cloud egress depends on provider labels | Destination/transport/origin policy for every adapter and every redirect; external custom origins require exact approval | external/generic HTTP reject + redirect-before-network regression |
| A3 API/data/DB fixtures initialize a browser | Context bootstrap moved from automatic auth fixture into demand-driven UI `context` fixture | `test:review:browser-free` runs the API/data/DB graph with `PLAYWRIGHT_BROWSERS_PATH` pointed at an empty proof directory, and CI executes it before browser installation |
| A4 shared-checkout runs collide | immutable `RUN_ID` created before config; reports/results/logs/audits scoped by APP/ENV/RUN_ID; latest pointer is non-authoritative | path-isolation regression + CI paths carry ENV/RUN_ID |
| A5 healing cache lacks env/concurrency safety | environment + locator-plan revision + TTL provenance; lock-protected read/modify/write; atomic publication; corrupt/legacy rejection | concurrent writer and stale-revision regressions |
| A6 locator probing bypasses waiting | bounded primary readiness wait precedes visible uniqueness check/recovery | delayed-primary browser regression; ambiguity contracts remain fail-closed |
| A7 generic HTTP provider reliability differs | shared timeout/abort/egress/redirect path; schema validation; categorized errors; one accounted attempt | malformed-response and stalled-provider regressions |
| A8 security exception is package-wide | exact package + advisory ID + range + owner + rationale + expiry policy | injected new advisory on same package/range remains blocking |

## Adjacent hardening found during implementation

The review correctly identified root risks, but implementation review found secondary consumers that also required change. CI upload/merge paths, business-report helper scripts, AI/healing audit locations and report-opening behavior were aligned to run-scoped roots. Business-report merge now rejects mixed application/environment/run identities, and portfolio execution propagates one immutable portfolio run ID instead of consulting a mutable latest-run pointer. Path-segment validation was added so a supplied `RUN_ID` cannot escape report/result directories. Windows replacement fallback was added to the atomic publication helpers used for run pointers and healing cache files. Cross-origin AI redirects are blocked by default; explicit opt-in still strips origin-bound credentials. Shared report/duration history is environment-scoped and lock/atomic-merge protected.

The existing `qa` CLI remains the primary daily workflow. v1.5.0 adds `qa:migrate` / `migration:assess` so an existing Playwright suite can be inventoried and migrated incrementally instead of requiring a bulk rewrite. The tool produces a non-mutating hotspot report and deliberately preserves assertions until the team moves code into governed project layers.

## Secure defaults

- AI stays disabled unless explicitly enabled.
- Loopback AI destinations are allowed by default; every external AI destination—including official provider endpoints—requires both cloud-egress permission and an exact `AI_ALLOWED_EXTERNAL_ORIGINS` entry. No provider name or built-in endpoint is implicitly trusted.
- Unmasked visual evidence is not a default. Masked mode is the default; automatic trace/video/screenshots are disabled unless a project explicitly accepts unmasked visual retention. Local run artifacts default to 14-day pruning from persisted run metadata; CI retention remains platform-owned.
- Healing remains deterministic first: primary readiness -> declared fallback -> validated cache -> optional AI, followed by semantic post-condition validation where required.
- API/data/DB-only tests remain browser-free.
- Generated artifacts belong to one application/environment/run.

## Release evidence commands

```bash
npm ci
npx playwright install chromium
npm run validate:final

# Focused independent-review regression suite
APP=demo ENV=qa npm run test:review:hardening

# Adoption assessment for an existing suite (read-only source scan)
APP=<project> ENV=<env> npm run qa:migrate -- path/to/existing/tests
```

Actual workspace validation evidence and its clean-CI boundary are recorded in `docs/34-v1.5.0-VALIDATION-EVIDENCE.md`.

The release archive should contain source and contracts only. `.runtime`, `.healing`, `.auth`, `reports`, `test-results`, browser reports, logs, caches and `node_modules` are generated locally/CI and must not be shipped.

## What code cannot honestly close

The product-owner review also asks for customer/pilot evidence: representative applications, multiple engineers, onboarding/authoring time, false-heal rate, triage time, CI wall time/cost and competitive benchmark results. Those are empirical product claims, not source-code defects. v1.5.0 provides the engineering controls and measurement-ready artifacts, but it does not fabricate pilot or market evidence. Use `docs/22-COMPETITIVE-BENCHMARK-PLAN.md` and `docs/32-PILOT-ADOPTION-AND-METRICS.md` to collect that evidence before making enterprise/commercial-readiness claims.
