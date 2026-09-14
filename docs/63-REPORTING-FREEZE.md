# REPORTING SURFACE FREEZE — v1.9.0

**Status: ACTIVE.** v1.9.0 certified at `6a32718353022da4e5ce51dace59e29692340913` after main and tag-triggered Release Compatibility passed 5/5. The reporting surface is now feature-frozen.

## Decision

After v1.9.0 certification, the TestigentAI business reporting surface is feature-frozen. Failure Intelligence and the isolated Customer Showcase complete the planned reporting capability set.

The approved top-level drill-downs are:

- Evidence Ledger / Evidence Graph
- Agentic Intelligence
- Adoption Intelligence
- Benchmark Intelligence
- API Contract Intelligence
- Failure Intelligence
- AI Provider Health
- Customer Showcase (synthetic demonstration only)

## Allowed post-freeze changes

Reporting may change for **bug/security/accessibility/compatibility/performance** fixes, correctness issues, browser portability, privacy/security hardening, dependency/platform compatibility, or backward-compatible adapters required to preserve existing contracts.

## Changes requiring explicit reporting architecture review

The following are not routine post-freeze work:

- new executive KPI cards;
- new release-readiness formulas;
- new top-level dashboard intelligence pages;
- silently changing the denominator or semantics of existing metrics;
- synthetic/demo data entering live execution or claim stores;
- AI output modifying deterministic release facts;
- removal/renaming of a frozen drill-down without a compatibility plan.

Any such proposal requires an explicit architecture/review decision and new executable reporting contracts before implementation.

## Customer showcase exception

The Customer Showcase is part of the frozen v1.9 surface. It is explicitly synthetic, separate from live facts and always `claimEligible=false`. It exists to explain capabilities before a customer has accumulated real evidence, not to manufacture market or adoption claims.
