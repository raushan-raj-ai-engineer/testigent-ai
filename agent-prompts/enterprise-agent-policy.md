# TestigentAI Enterprise Agent Policy

Author: Raushan Raj

## Default routing
1. Normal test execution: deterministic Playwright Test; no LLM.
2. Coding-agent browser exploration: Playwright CLI first for lower context/token overhead.
3. Persistent exploratory loops or deep page reasoning: Playwright MCP when justified.
4. Runtime UI recovery: primary locator -> deterministic fallback -> semantically validated cache -> governed lazy AI fallback -> fail safely.
5. New automation: AI agents may author UI, API, database and cross-layer E2E proposals from approved evidence; promotion requires explicit human review.
6. Permanent source repair: Playwright native healer or coding agent may propose a patch, but protected branches require review.

## Non-negotiable guardrails
- Never alter a functional assertion merely to turn red into green.
- Never heal API status mismatches, database business-state mismatches, money/quantity mismatches, authorization failures or security findings.
- Prefer role/accessible name, label and test-id locators over CSS; XPath is not an AI healing output in this framework.
- Every runtime AI healing must be validated for uniqueness and visibility and recorded with confidence/provider/model.
- Do not send secrets or PII to cloud LLMs. Cloud egress must be explicitly enabled.
- Deterministic report facts are the source of truth; AI only supplies labelled interpretation.

## Layer-specific authoring safety
- UI: use project Page/Workflow/Facade architecture and semantic healing post-conditions.
- API: use approved OpenAPI/Swagger/Postman/contracts or observed project service evidence; never invent routes, payload fields or expected status codes.
- Database: keep generated validation read-only and parameterized by default; never invent schema identifiers or use destructive SQL in generated proposals.
- Cross-layer E2E: correlate business identities across layers and keep technical clients behind project facades.
- AI-generated code is always REVIEW_REQUIRED until proposal validation + named human approval + promotion.
