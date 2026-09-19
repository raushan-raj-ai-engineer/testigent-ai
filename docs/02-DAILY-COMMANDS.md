# Daily Commands — TestigentAI v1.10.3

This guide keeps the normal engineer surface small. Advanced scripts exist, but daily work should prefer the governed `qa:*` and unified `qa create` entry points.

## Select workspace

```bash
npm run project:list
npm run qa:use -- <project> <environment>
npm run qa:status
npm run qa:doctor
```

## Create automation from a requirement

Recommended workflow:

```bash
npm run qa -- create <requirement-source>
```

Examples:

```bash
npm run qa -- create projects/<project>/requirements/create-order.md
npm run qa -- create JIRA:PAY-142
npm run qa -- create JIRA:PAY-142 --auto-explore
npm run qa -- create JIRA:PAY-142 --learn="Create Order Journey"
```

Optional guided review/promotion:

```bash
npm run qa -- create JIRA:PAY-142 \
  --learn="Create Order Journey" \
  --reviewer="QA Lead" \
  --review-and-promote
```

Legacy `qa:new`, `qa -- explore`, `qa -- learn` and `qa -- generate` entry points may remain for compatibility; new documentation and onboarding should prefer the unified create workflow.

## Run tests

```bash
npm run qa:test -- --project=chromium
```

Layer-specific:

```bash
npm run test:ui
npm run test:api
npm run test:db
npm run test:e2e
npm run test:visual
npm run test:accessibility
npm run test:performance
```

Profiles:

```bash
npm run test:profile:pr
npm run test:profile:regression
```

## Authentication

```bash
npm run auth:check
npm run auth:prepare
```

MFA/manual-only flows:

```bash
npm run qa:auth
```

## Reporting

```bash
npm run qa:report
npm run report:open
npm run report:dashboard
npm run report:business
npm run report:mail:preview
```

## Impact / migration

```bash
npm run qa:impact -- --base main --head HEAD
npm run qa:migrate -- projects/<project>/tests
```

## Healing maintenance

```bash
npm run qa:heal
```

## Multi-project execution

```bash
npm run test:projects -- --all --env=qa --profile=regression --project=chromium
```

Named portfolio:

```bash
npm run test:projects -- --group=<name> --profile=regression --project=chromium
```

## Framework validation

Fast focused checks:

```bash
npm run architecture:check
npm run authoring:unified-contract
npm run typecheck
npm run test:framework:critical
npm run security:check
```

Full merge/release-quality validation:

```bash
npm run validate:final
```

## External/public integration checks

External endpoints are isolated from deterministic framework certification:

```bash
npm run test:external
```

Optional strict performance enforcement:

```bash
RUN_EXTERNAL_TESTS=true \
PERFORMANCE_BUDGET_ENFORCED=true \
npm run test:external
```

## Typical daily sequence

```bash
npm run qa:status
npm run qa:doctor
npm run qa -- create <requirement-source>
npm run qa:test -- --project=chromium
npm run qa:validate
npm run qa:report
```
