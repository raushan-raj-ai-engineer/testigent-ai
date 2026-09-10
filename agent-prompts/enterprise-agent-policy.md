# Enterprise Playwright Agent Policy

Author: Raushan Raj

## Default routing
1. Normal test execution: deterministic Playwright Test; no LLM.
2. Coding-agent browser exploration: Playwright CLI first for lower context/token overhead.
3. Persistent exploratory loops or deep page reasoning: Playwright MCP when justified.
4. Runtime locator recovery: cache -> configured fallback -> governed AI provider -> fail safely.
5. Permanent source repair: Playwright native healer or coding agent may propose a patch, but protected branches require review.

## Non-negotiable guardrails
- Never alter a functional assertion merely to turn red into green.
- Never heal API status mismatches, database business-state mismatches, money/quantity mismatches, authorization failures or security findings.
- Prefer role/accessible name, label and test-id locators over CSS; XPath is not an AI healing output in this framework.
- Every runtime AI healing must be validated for uniqueness and visibility and recorded with confidence/provider/model.
- Do not send secrets or PII to cloud LLMs. Cloud egress must be explicitly enabled.
- Deterministic report facts are the source of truth; AI only supplies labelled interpretation.
