# Daily Commands

## Setup and health

```bash
npm ci
npx playwright install chromium
npm run release:static
npm run architecture:check
npm run framework:health
npm run typecheck
npm run validate:final
```

## Projects

```bash
npm run project:list
npm run project:new -- project2
APP=project2 ENV=qa npm run project:check
```

## Run one project

```bash
APP=project2 ENV=qa npm run test:project -- --project=chromium
APP=project2 ENV=qa npm run test:smoke -- --project=chromium
APP=project2 ENV=qa npm run test:regression -- --project=chromium
APP=project2 ENV=qa npm run test:ui -- --project=chromium
APP=project2 ENV=qa npm run test:api -- --project=chromium
APP=project2 ENV=qa npm run test:db -- --project=chromium
APP=project2 ENV=qa npm run test:e2e -- --project=chromium
APP=project2 ENV=qa npm run test:headed -- --project=chromium
```

Pass normal Playwright options after `--`, for example:

```bash
APP=project2 ENV=qa npm run test:project -- --project=chromium --grep @critical --workers=2
```

## Authentication and safe application learning

```bash
APP=project2 ENV=qa APPLICATION_EXPLORATION_ENABLED=true npm run app:auth
APP=project2 ENV=qa APPLICATION_EXPLORATION_ENABLED=true npm run app:explore
APP=project2 ENV=qa APPLICATION_EXPLORATION_ENABLED=true npm run app:learn
```

`test:project` automatically reads the configured storage-state path. Do not manually pass `PW_STORAGE_STATE` during normal use.

## Reports

```bash
APP=project2 ENV=qa npm run report:dashboard
APP=project2 ENV=qa npm run report:business
APP=project2 ENV=qa npm run report:mail:preview
APP=project2 ENV=qa npm run report:open
APP=project2 ENV=qa npm run report:serve
```

Reports are isolated under `reports/<project>/` and test artifacts under `test-results/<project>/`.

## Requirement-to-automation

```bash
APP=project2 ENV=qa npm run requirement:analyze -- projects/project2/requirements/feature.md
APP=project2 ENV=qa npm run requirement:test-plan -- projects/project2/requirements/feature.md
APP=project2 ENV=qa TEST_GENERATION_ENABLED=true npm run requirement:generate -- projects/project2/requirements/feature.md
npm run proposal:list
npm run proposal:validate -- <proposal-id>
npm run proposal:approve -- <proposal-id>
npm run proposal:promote -- <proposal-id>
```

Generated proposals remain review-blocked until human approval.

## Cleanup

```bash
npm run clean
npm run clean:all
```

`clean` removes generated reports/results/runtime caches. `clean:all` also removes local auth and report history; use it only when you deliberately want to re-authenticate and reset local trend history.


## AI provider checks

AI is optional and provider-neutral. Configure `.env` first.

Generic configured-provider health check:

```bash
npm run ai:check
```

Generic configured-provider AI healing test:

```bash
APP=demo ENV=qa npm run test:ai-healing
```

Explicit local Ollama convenience run:

```bash
npm run test:ai-healing:ollama
```

Explicit Gemini convenience run (requires key/model in `.env` and cloud egress approval):

```bash
npm run test:ai-healing:gemini
```

See `13-AI-PROVIDER-EXAMPLES.md` for local and CI examples.


## AI / agent authoring

```bash
npm run ai:check
npm run test:ai-healing
npm run agents:check
PLAYWRIGHT_AGENT_LOOP=vscode npm run agents:init
APP=my-project ENV=qa npm run test:new -- projects/my-project/requirements/feature.md --mode=agents
npm run authoring:complete -- feature
npm run authoring:report
```
