# Start Here

This repository is a reusable enterprise Playwright + TypeScript quality platform. Framework engines live under `src/framework/`; application-owned automation lives under `projects/<project>/`.

## First-time setup

```bash
npm ci
npx playwright install chromium
npm run validate:final
npm run project:list
```

## Daily flow

```bash
APP=demo ENV=qa npm run project:check
APP=demo ENV=qa npm run test:project -- --project=chromium
APP=demo ENV=qa npm run report:open
```

For a project that requires stored authentication:

```bash
APP=my-project ENV=qa APPLICATION_EXPLORATION_ENABLED=true npm run app:auth
APP=my-project ENV=qa npm run test:project -- --project=chromium
```

Never commit `.auth`, `.env`, reports, test results, healing cache, learned application evidence, or proposal backups.

Read next: `01-ARCHITECTURE.md`, `02-DAILY-COMMANDS.md`, and `03-ADD-NEW-PROJECT.md`. For team onboarding also read `14-ROOT-FOLDERS-AND-LOCAL-STATE.md` and `15-NEW-PROJECT-HANDOFF.md`. If AI/healing or agent-assisted authoring is required, continue with `07-HEALING-AI-MCP.md`, `13-AI-PROVIDER-EXAMPLES.md`, and `16-PLAYWRIGHT-AGENTS-PRODUCTIVITY.md`.
