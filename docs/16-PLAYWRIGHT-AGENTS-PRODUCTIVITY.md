# Playwright Agents, CLI, MCP and Productivity

## Supported agent model

TestigentAI uses Playwright's planner -> generator -> healer model, but places repository architecture between agent evidence and production code. Every project contains `tests/_agent/seed.spec.ts` so agents inherit the project's fixtures/setup/auth context rather than inventing a parallel test style.

Official reference: https://playwright.dev/docs/test-agents

## Recommended new-test pipeline

```text
Requirement
  -> Planner + project seed
  -> reviewed Markdown plan
  -> live browser evidence (CLI/MCP/generator)
  -> TestigentAI architecture mapping
       Page LocatorPlans
       Workflows/domain services
       App/API/repository facades
       business spec
  -> architecture/type/authoring validation
  -> human review/promotion
```

Start with:

```bash
npm run qa:use -- my-project qa
npm run qa:agents -- vscode
npm run qa:new -- checkout
```

## Which browser interface to use

- **Playwright CLI**: preferred for high-throughput coding-agent work and compact browser evidence.
- **MCP**: useful when persistent structured browser state and iterative exploration are more valuable.
- **Planner/Generator/Healer agents**: useful for a governed end-to-end authoring loop.

The developer should not manually choose a different application setup: the selected project's seed test is the source of fixture/auth context.

## Generator rule

Raw agent-generated Playwright is evidence, not automatically production-ready code. Final normal specs use project fixtures/facades and contain no raw `page.goto/locator/click/fill`, URLs, credentials, or direct healer/AI/API/DB infrastructure construction.

## Healing rule

Two responsibilities are deliberately separated:

1. **Runtime healing** — TestigentAI resolves a safe locator candidate during execution, validates it and records audit evidence without editing source.
2. **Source maintenance** — `npm run qa:heal` ranks repeated recoveries and creates a review prompt. Playwright healer/CLI may verify the live UI and propose LocatorPlan/scoping/synchronization changes only.

Source healing must not weaken business assertions or API/DB/security outcomes and must not add skip/fixme to make a defect disappear.

## Repository agent overlay

`npm run agents:policy` applies `TESTIGENTAI ENTERPRISE QUALITY OVERLAY V2` to generated repository agent definitions. It requires the project seed/facade architecture, prevents silent assertion weakening, and keeps generated changes in human-reviewed proposal flow.

## Productivity measurement

`test:new`/`qa:new` can record authoring sessions. Complete and report them with:

```bash
npm run authoring:complete -- <requirement-id>
npm run authoring:report
```

Only compare against a team-owned manual baseline. Do not present estimated savings as measured time.
