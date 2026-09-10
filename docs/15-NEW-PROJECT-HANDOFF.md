# New Project Handoff

Use this checklist when another project/team adopts the framework. The goal is that a new project adds only project-owned code and configuration; reusable framework code is not copied or edited.

## 1. Create the project

```bash
npm run project:new -- project2
```

This creates `projects/project2/` from the supported template.

## 2. Configure environment

Edit:

```text
projects/project2/config/qa.json
```

Set only project-owned values such as UI base URL, API base URL and authentication strategy. Secrets belong in `.env` locally or the CI secret store, not in project JSON.

## 3. Add project-owned automation

```text
projects/project2/
├── config/          # non-secret environment/application configuration
├── data/            # project test datasets
├── fixtures/        # fixture extensions that compose reusable framework capabilities
├── requirements/    # PRD/story/acceptance-criteria inputs
├── src/
│   ├── pages/       # UI mechanics + LocatorPlan
│   ├── workflows/   # business journeys
│   ├── api/         # domain API services
│   └── database/    # domain repositories/queries
└── tests/           # UI/API/DB/E2E specs
```

Do not copy another project's selectors, workflows, endpoints, table names or domain data.

## 4. Validate before adding tests

```bash
APP=project2 ENV=qa npm run project:check
npm run architecture:check
```

## 5. New test development with Playwright agents/MCP

Place the requirement in `projects/project2/requirements/feature.md` and choose an authoring mode:

```bash
APP=project2 ENV=qa npm run test:new -- projects/project2/requirements/feature.md --mode=agents
```

For a team using Playwright Test Agents, initialize only its chosen coding-agent loop:

```bash
PLAYWRIGHT_AGENT_LOOP=vscode npm run agents:init
npm run agents:check
```

The intended agent loop is:

```text
Planner -> live application exploration -> Markdown test plan
Generator -> framework-compliant Page/Workflow/Test proposal
Healer -> execute/repair failing generated tests within guardrails
Human review -> proposal approval/promotion
```

Generated tests remain proposals until human review and validation. MCP/agents accelerate evidence gathering and authoring; they do not bypass architecture, security, assertions, or review gates.

## 6. Measure authoring productivity without inventing savings

`test:new` starts an authoring timer automatically when `AUTHORING_PRODUCTIVITY_ENABLED=true` (the default example). After implementation and validation:

```bash
npm run authoring:complete -- feature
npm run authoring:report
```

The measured elapsed time is factual. To calculate an estimated saving, the team may set an agreed comparable manual baseline:

```env
AUTHORING_PRODUCTIVITY_ENABLED=true
AUTHORING_MANUAL_BASELINE_MINUTES=120
```

Do not set a baseline merely to produce a positive percentage. Management reporting distinguishes measured elapsed time from baseline-derived estimates.

## 7. Project release validation

```bash
APP=project2 ENV=qa npm run validate:project
npm run validate:final
```

Share with a new team: this document, `00-START-HERE.md`, `01-ARCHITECTURE.md`, `02-DAILY-COMMANDS.md`, `07-HEALING-AI-MCP.md`, and the project template README.
