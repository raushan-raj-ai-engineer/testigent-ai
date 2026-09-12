# TestigentAI Automation Generation Contract
Author: Raushan Raj

Generate automation from approved requirement and layer evidence. UI may use Playwright CLI/MCP/Test Agents; API uses approved API contracts/evidence; database uses approved schema/repository evidence. Generated code must follow project Facade boundaries and the repository architecture.

UI actions are never emitted as raw actions in generated specs. Page Objects define semantic LocatorPlan objects and execute them through HealingOrchestrator/BasePage healing helpers. Scope modal/component controls. Prefer deterministic primary + fallbacks; AI is optional last resort and must remain behind AiGateway confidence/uniqueness/audit gates.

Never heal functional assertions, API/DB failures, auth defects, or business expectations.

## API / Database / E2E
- API proposal code belongs in project domain services behind `api` facade; raw request contexts stay out of business specs.
- DB proposal code belongs in project repositories behind `repositories` facade; generated DB validation is read-only by default.
- Mixed-layer scenarios should prove one business outcome across UI/API/DB using a correlated business identifier.
- Every generated proposal remains human-review gated before promotion.
