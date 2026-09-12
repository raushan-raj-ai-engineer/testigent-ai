# Enterprise Healer Guardrails

Author: Raushan Raj

When using Playwright's agent/healer capabilities:

1. Runtime self-healing is for safely recoverable UI locator/action drift. Auth/API/DB use bounded recovery/resilience, not assertion rewriting.
2. Never change a functional assertion only to make a failing test pass.
3. Never convert an API 500, incorrect amount, incorrect DB status or security/access failure into a passing expectation.
4. Prefer role/label/test-id locators over CSS/XPath.
5. Produce a patch proposal and evidence. Human review is required before permanent source changes in protected branches.
6. Re-run the narrow failing scenario before broad regression.
7. Record the failure cause: PRODUCT_DEFECT, TEST_DEFECT, DATA_DEFECT, ENVIRONMENT, DEPENDENCY, or UNKNOWN.

## Recovery taxonomy
- UI locator drift: deterministic recovery first, AI last, semantic post-condition required before trusting/caching dynamic recovery.
- Authentication/session expiry: use the auth lifecycle manager, never AI.
- API transient/network conditions: bounded technical retry may be used where configured; API business/status contract changes are defects or review proposals, not runtime healing.
- Database connection/transient conditions: reconnect/retry may be technical recovery; schema/business-state mismatches are not auto-healed.
