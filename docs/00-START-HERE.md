# Start Here — TestigentAI v1.10.3

TestigentAI is a multi-project Playwright + TypeScript Quality Engineering platform covering UI, API, database, AI-assisted authoring, governed healing, CI/CD and business reporting.

This document is the fastest route for a new engineer, reviewer, recruiter or client who wants to understand the repository without reading the full historical documentation set.

## 1. Understand the architecture

The repository has one core rule:

> Reusable capability belongs in `src/framework/`. Product behavior belongs in `projects/<project>/`.

A business test should normally flow through:

```text
Business Spec
  -> Project Fixture / Facade
  -> Workflow / Domain Service
  -> Page / API Service / Repository
  -> Reusable TestigentAI Core
```

This keeps UI selectors, API routes, SQL and business expectations inside the product while shared infrastructure remains reusable.

## 2. Install

```bash
npm ci
npx playwright install chromium
```

## 3. Select a project

```bash
npm run project:list
npm run qa:use -- demo qa
npm run qa:doctor
```

## 4. Run the deterministic product tests

```bash
npm run qa:test -- --project=chromium
```

## 5. Create new automation

The recommended v1.10.x authoring surface is:

```bash
npm run qa -- create <requirement-source>
```

Examples:

```bash
npm run qa -- create projects/demo/requirements/todo-create.md
npm run qa -- create JIRA:PAY-142 --auto-explore
npm run qa -- create JIRA:PAY-142 --learn="Create Order Journey"
```

Generated automation remains review-gated before promotion.

## 6. Run by layer

```bash
npm run test:ui
npm run test:api
npm run test:db
npm run test:e2e
```

Database capability is project/environment owned and supports `postgres`, `mysql` and `mssql` modes when configured.

## 7. Open reports

```bash
npm run qa:report
```

Business reporting is separate from the raw Playwright report and preserves known-defect, retry, healing and CI-blocking semantics.

## 8. Validate before merge/release

```bash
npm run validate:final
```

The validation chain covers static/release integrity, architecture, authoring contracts, framework health, scale/profile checks, reporting, type checks, framework regressions and security.

## 9. External/demo integrations

Public endpoints are intentionally isolated from the deterministic product certification path.

```bash
npm run test:external
```

Strict public performance enforcement can be enabled explicitly when needed.

## 10. Where to read next

- `README.md` — public/product overview
- `docs/01-ARCHITECTURE.md` — architecture rules
- `docs/02-DAILY-COMMANDS.md` — normal engineer commands
- `docs/05-UI-API-DB-DATA.md` — cross-layer testing
- `docs/07-HEALING-AI-MCP.md` — recovery, AI and MCP
- `docs/18-MULTI-PROJECT-EXECUTION.md` — portfolio execution
- `docs/29-AGENT-AUTHORING-UI-API-DB-E2E.md` — governed agent authoring
- `docs/41-CURRENT-RELEASE-STATUS.md` — current release evidence
- `docs/76-v1.10.3-FINAL-CERTIFICATION.md` — v1.10.3 final certification

## 11. For a technical reviewer

The fastest review path is:

1. Read `README.md`.
2. Inspect `src/framework/` versus `projects/` ownership.
3. Inspect `.github/workflows/playwright-sharded.yml`.
4. Run `npm run architecture:check`.
5. Run `npm run authoring:unified-contract`.
6. Run `npm run validate:final`.
7. Inspect the generated business report and evidence.

## 12. For recruiter / freelance review

Focus on these capabilities:

- Playwright + TypeScript automation architecture
- UI + API + database validation
- multi-project/product isolation
- CI/CD and sharded execution
- AI-assisted, human-governed test authoring
- self-healing with semantic validation
- reporting and failure intelligence
- security and architecture gates

The repository is intended to be reviewable as proof-of-work rather than a black-box demo.
