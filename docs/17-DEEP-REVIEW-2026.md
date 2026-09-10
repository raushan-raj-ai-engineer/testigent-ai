# Enterprise Framework Deep Review

## Executive assessment

The framework now has a clean separation between reusable capabilities (`src/framework`) and project-owned automation (`projects/<project>`), explicit AI-provider selection, guarded self-healing, business reporting, requirement intelligence, project onboarding, and Playwright Test Agent/MCP authoring support. The review focused on reducing hidden defaults, making AI usage auditable, removing optional root clutter, and turning agent-assisted test authoring into a measurable but non-inflated management story.

## Key findings and implemented changes

### AI runtime observability

A configured provider health check proves configuration, but it does not by itself prove which provider handled a particular healing request. The framework now writes a security-safe runtime AI audit for each actual AI call. Audit records include run/test correlation, purpose, status, actual provider/model returned, and latency. Prompts, accessibility snapshots, API keys and raw model output are not stored in this audit.

The business dashboard, executive summary and stakeholder email expose provider/model usage separately from deterministic quality metrics. AI cannot overwrite pass rate, test status, failure classification or release-gate facts.

### Root-folder cleanup

Pre-generated `.claude`, `.codex`, `.opencode`, `opencode.json`, and empty `.playwright` content are not shipped. Playwright recommends regenerating agent definitions when Playwright is updated, so generating only the selected loop avoids stale tool-specific copies and root clutter. `.github` remains because it contains CI workflows and the repository-level VS Code/GitHub agent example. Runtime folders remain gitignored and cleanable.

### Playwright agents and MCP

Playwright provides planner, generator and healer agents. The framework now documents a concrete authoring flow that uses those agents/MCP for live evidence and proposal generation while preserving the framework's human review, architecture and deterministic execution gates. Agent definitions are generated through one provider-neutral command.

### Productivity evidence

A new authoring productivity flow records measured elapsed authoring time. Estimated savings are calculated only when the team deliberately supplies a comparable manual baseline. This prevents management reports from presenting invented time savings as fact.

### New-project education

A dedicated handoff guide explains project creation, ownership boundaries, secrets, test authoring, agents/MCP, validation and productivity reporting. The template README points teams to the same contract.

## External evidence

1. Playwright, "Playwright Test Agents." Planner, generator and healer are official Playwright Test Agents; agent definitions are initialized with `playwright init-agents` and should be regenerated after Playwright upgrades. https://playwright.dev/docs/test-agents
2. GitHub Docs, "About custom agents." Repository-level custom agents encode specialized prompts, tools and MCP servers and can be stored in `.github/agents`. https://docs.github.com/en/copilot/concepts/agents/copilot-cli/about-custom-agents
3. GitHub Docs, "Custom agents configuration." Defines the supported repository custom-agent configuration model. https://docs.github.com/en/copilot/reference/custom-agents-configuration

## Management positioning

A defensible message is: agent/MCP-assisted authoring reduces repetitive browser exploration and scaffolding, while generated code still passes the same deterministic compile, test, security and human-review gates. Productivity improvement should be reported from measured sessions and agreed baselines, not from a generic industry percentage.
