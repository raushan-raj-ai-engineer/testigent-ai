# Enterprise Playwright Test Generation Contract
Author: Raushan Raj

Use Playwright CLI, MCP, or Playwright Test Agents to inspect the live app. Generated code must follow this repository's Page -> Workflow -> Test architecture.

UI actions are never emitted as raw actions in generated specs. Page Objects define semantic LocatorPlan objects and execute them through HealingOrchestrator/BasePage healing helpers. Scope modal/component controls. Prefer deterministic primary + fallbacks; AI is optional last resort and must remain behind AiGateway confidence/uniqueness/audit gates.

Never heal functional assertions, API/DB failures, auth defects, or business expectations.
