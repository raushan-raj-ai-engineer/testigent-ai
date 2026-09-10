# Playwright Test Agents and Productivity

## What is actually integrated

The framework supports Playwright's official Test Agent pattern: planner, generator and healer. Playwright documents these agents as a sequence where the planner explores the application and writes a Markdown plan, the generator turns that plan into Playwright tests, and the healer executes/repairs failing tests. The definitions are initialized with `npx playwright init-agents --loop=...` and should be regenerated after Playwright upgrades.

Source: https://playwright.dev/docs/test-agents

The repository also contains Playwright Test MCP configuration (`.mcp.json` and `.vscode/mcp.json`). MCP supplies structured Playwright tools to a compatible coding agent. It does not replace deterministic Playwright Test execution.

## Recommended new-test workflow

```bash
npm run agents:check
PLAYWRIGHT_AGENT_LOOP=vscode npm run agents:init
APP=my-project ENV=qa npm run test:new -- projects/my-project/requirements/checkout.md --mode=agents
```

Then use the generated `PLAYWRIGHT_AUTHORING_PROMPT.md` with the selected coding-agent loop and direct it through:

1. planner — inspect the live application and create/refine the test plan;
2. generator — implement the plan using the repository's Page Object, fixture, LocatorPlan and test.step contracts;
3. healer — run failing generated tests and propose constrained repairs;
4. human reviewer — validate evidence and promote only approved generated proposals.

This mirrors the official Playwright agent workflow while preserving framework governance.

## Why this can save time

The productivity claim should be evidence-based. Automatic session timing can be disabled with `AUTHORING_PRODUCTIVITY_ENABLED=false` when a team does not want local authoring telemetry. The framework records authoring-session elapsed time and can compare it with a team-owned manual baseline only when such a baseline is configured.

```bash
npm run authoring:report
```

Outputs:

```text
reports/<project>/productivity/authoring-productivity.json
reports/<project>/productivity/authoring-productivity.md
```

Management-safe metrics include:

- number of completed agent/MCP/CLI authoring sessions;
- measured authoring minutes;
- authoring mode used;
- optional comparable manual baseline;
- estimated minutes saved and savings percentage only for baseline-backed sessions.

Do not present an estimate as measured productivity. For a stronger management case, compare several similar features before and after agent-assisted authoring and keep review/rework time in the measurement.

## Repository custom agents

GitHub supports repository-level custom agents under `.github/agents`, allowing tool/prompt/MCP conventions to be encoded once for a repository. This is why the framework keeps its repository-level agent definitions while tool-specific Claude/Codex/OpenCode trees are generated only when needed.

Sources:
- https://docs.github.com/en/copilot/concepts/agents/copilot-cli/about-custom-agents
- https://docs.github.com/en/copilot/reference/custom-agents-configuration


## CLI/skills versus MCP

Microsoft's Playwright MCP project notes that CLI + skills can be more token-efficient for high-throughput coding-agent work, while MCP remains useful when persistent browser state, richer introspection and iterative exploration/healing matter. The framework therefore supports all three authoring modes instead of forcing one:

```text
--mode=cli     -> fast/high-throughput browser evidence through Playwright CLI/skills
--mode=mcp     -> persistent structured browser exploration
--mode=agents  -> official planner -> generator -> healer Test Agent loop
```

Source: https://github.com/microsoft/playwright-mcp

## Enterprise agent overlay

`npm run agents:init` regenerates the official Playwright definitions and immediately applies `scripts/harden-agent-definitions.ts`. The overlay prevents generated agent instructions from bypassing project Page Objects, LocatorPlan/healing, known-defect governance or human proposal promotion. Repository agent files intentionally do not pin a model; model/provider choice remains with the approved coding-agent/client configuration.
