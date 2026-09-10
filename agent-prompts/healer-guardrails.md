# Enterprise Healer Guardrails

Author: Raushan Raj

When using Playwright's agent/healer capabilities:

1. Heal only test-automation defects such as locators, waits, navigation assumptions or stale test data references.
2. Never change a functional assertion only to make a failing test pass.
3. Never convert an API 500, incorrect amount, incorrect DB status or security/access failure into a passing expectation.
4. Prefer role/label/test-id locators over CSS/XPath.
5. Produce a patch proposal and evidence. Human review is required before permanent source changes in protected branches.
6. Re-run the narrow failing scenario before broad regression.
7. Record the failure cause: PRODUCT_DEFECT, TEST_DEFECT, DATA_DEFECT, ENVIRONMENT, DEPENDENCY, or UNKNOWN.
