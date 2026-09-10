# Enterprise Playwright Framework

A clean multi-project Playwright + TypeScript quality platform for UI, API, database and data-driven automation with project-scoped reporting, guarded self-healing, optional AI/MCP tooling, requirement intelligence and CI/CD support.

## Design rule

**Reusable capability belongs in `src/framework`. Product/application behavior belongs in `projects/<project>`.** No project may import another project.

```text
src/framework/          reusable core and engines
projects/demo/          deterministic reference project
projects/sdet-practice/ real project example + known AUT defect
projects/project2/      generated with project:new
tests/framework/        platform regression only
templates/project/      onboarding skeleton
```

## Install and validate

```bash
npm ci
npx playwright install chromium
npm run validate:final
```

## Daily use

```bash
npm run project:list
APP=demo ENV=qa npm run project:check
APP=demo ENV=qa npm run test:project -- --project=chromium
APP=demo ENV=qa npm run report:open
```

Create another team/application area:

```bash
npm run project:new -- project2
```

For authenticated projects:

```bash
APP=project2 ENV=qa APPLICATION_EXPLORATION_ENABLED=true npm run app:auth
APP=project2 ENV=qa npm run test:project -- --project=chromium
```

Start with [`docs/00-START-HERE.md`](docs/00-START-HERE.md) and [`docs/02-DAILY-COMMANDS.md`](docs/02-DAILY-COMMANDS.md). For AI setup, use [`docs/07-HEALING-AI-MCP.md`](docs/07-HEALING-AI-MCP.md) and [`docs/13-AI-PROVIDER-EXAMPLES.md`](docs/13-AI-PROVIDER-EXAMPLES.md). Research basis is in [`docs/SOURCES.md`](docs/SOURCES.md).


## Release validation

See [`docs/12-RELEASE-VALIDATION.md`](docs/12-RELEASE-VALIDATION.md). The release gate is `npm run validate:final`.


## Team onboarding and AI/agent governance

- Root/local-state guide: `docs/14-ROOT-FOLDERS-AND-LOCAL-STATE.md`
- New-project handoff: `docs/15-NEW-PROJECT-HANDOFF.md`
- Playwright agents + productivity: `docs/16-PLAYWRIGHT-AGENTS-PRODUCTIVITY.md`
- Deep review: `docs/17-DEEP-REVIEW-2026.md`
