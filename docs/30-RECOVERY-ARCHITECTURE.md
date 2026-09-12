# Recovery Architecture — Deterministic First, AI Last

## Why recovery is separated by layer

A locator rename, an expired login token, an HTTP 500 and an incorrect database status are not the same class of problem. TestigentAI therefore avoids one generic "self-heal everything" mechanism.

```text
TestigentAI Recovery Model
│
├── UI locator/action recovery
│   └── primary -> fallback -> validated cache -> lazy AI -> semantic proof
│
├── Authentication recovery
│   └── freshness check -> refresh -> fresh-context verification -> bounded runtime recovery
│
├── API resilience
│   └── technical/transient handling only; contract/status/business mismatches are not auto-healed
│
└── Database resilience
    └── connection/transient handling only; schema/business-state mismatches are not auto-healed
```

## UI recovery

`HealingOrchestrator` is intentionally UI-specific because it operates on Playwright locators/actions. The AI provider is **lazy**: provider configuration/network objects are not created while primary/fallback/cache recovery is sufficient.

This protects performance and prevents healthy non-AI tests from failing merely because an optional AI provider is not configured.

Dynamic AI recovery is eligible only when:

1. `HEALING_MODE=runtime`;
2. `HEALING_AI_ENABLED=true` and `AI_ENABLED=true`;
3. deterministic candidates are exhausted;
4. an approved provider is configured;
5. the proposed locator meets confidence/safety rules;
6. the business post-condition proves the intended action succeeded.

## Authentication recovery

Authentication uses `AuthManager`, not LLMs. Project-owned auth providers refresh credentials/session state; the core manages freshness, locking, promotion and verification.

## API recovery boundary

API infrastructure may use safe technical resilience where explicitly configured (for example bounded retry/backoff for network/transient dependency failure). It must not silently change:

- endpoint path/version;
- HTTP method;
- expected status/business contract;
- authorization expectation;
- payload schema/business value.

An AI agent may **diagnose and propose a source change** for review, but runtime automation must fail when the contract no longer matches.

## Database recovery boundary

Database infrastructure may reconnect/retry transient connection conditions where an adapter/policy supports it. It must not silently change:

- table/column/schema names;
- expected persisted status/value;
- security/permission expectations;
- reconciliation/business rules.

AI may propose source maintenance from approved schema evidence, but human review is required.

## Runtime vs source healing

| Capability | Automatic runtime use | Human review required |
|---|---:|---:|
| reviewed UI fallback | Yes | Source change already reviewed |
| semantically validated cached locator | Yes in runtime mode | No new source change |
| AI locator fallback | Yes in runtime mode after proof | Source promotion still review-only |
| auth/session refresh | Yes when project lifecycle allows | Provider implementation reviewed in source |
| API contract change | No | Yes |
| DB schema/business-state change | No | Yes |
| permanent generated patch | No | Yes |

## Business reporting

Only **semantically validated** UI recovery contributes to `PASSED_WITH_HEALING`. Rejected/suggested/unverified attempts remain engineering diagnostics. AI cannot alter deterministic quality outcomes or CI-blocking counts.
