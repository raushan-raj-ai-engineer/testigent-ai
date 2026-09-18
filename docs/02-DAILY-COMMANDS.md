# Daily Commands

Current certified baseline: **v1.6.0**. For Git/GitHub CLI branch, PR, CI, rerun, tag and cleanup commands, use `40-GIT-GITHUB-CLI-TERMINAL-GUIDE.md`.

## Recommended new-joiner surface

```bash
npm ci
npx playwright install chromium
npm run qa:use -- <project> <environment>
npm run qa:doctor
npm run qa:status
```

For auth-required projects with lifecycle auto-refresh:

```bash
npm run auth:check
npm run auth:prepare       # optional warm-up/diagnostic; qa:test prepares automatically
```

For MFA/manual-only projects:

```bash
npm run qa:auth
```

Auth is verified in a fresh browser context before promotion. A project with auto-refresh can refresh missing/near-expiry auth before workers start and recover at a safe navigation boundary during execution. Mutating actions are not blindly retried.

Create or generate automation with one command:

```bash
# Requirement file or Jira
npm run qa -- create checkout
npm run qa -- create projects/<project>/requirements/checkout.md
npm run qa -- create JIRA:PAY-142

# Optional application learning in the same command
npm run qa -- create JIRA:PAY-142 --auto-explore
npm run qa -- create JIRA:PAY-142 --learn="Checkout Journey"
```

The same workflow handles normal and complex UI automatically. There is no separate complex-user command.

Run and validate:

```bash
npm run qa:test -- --project=chromium
npm run qa:validate
npm run qa:validate -- --with-tests
npm run qa:report
```

Build source-healing maintenance candidates from repeated runtime recovery evidence:

```bash
npm run qa:heal
```

Initialize the selected Playwright coding-agent loop when needed:

```bash
npm run qa:agents -- vscode
# codex | claude | opencode are also supported when installed/approved
```

## One-off / CI overrides

Local developers normally use `qa:use`. CI is explicit:

```bash
APP=project2 ENV=qa npm run auth:check
APP=project2 ENV=qa npm run test:project -- --project=chromium
npm run validate:final
```

There is intentionally no default project/environment in reusable runtime code.

## Advanced commands

The repository still exposes specialized commands (`test:ui`, `test:api`, `test:db`, requirement/proposal tools, scenario authoring, reporting and AI checks). These are implementation building blocks and advanced workflows; a new joiner should begin with `qa:*` rather than learning the entire command catalog.

## Database capability policy

Database use is project/environment configurable and enforced by the reusable framework. Optional unavailable DB capability skips `@db` tests with a clear reason; required unavailable DB fails readiness before execution. The selected project's config owns the DB type; machine-level `DB_TYPE` values cannot activate DB tests in another project.

## Multi-project / customer portfolio execution

Run a selected set of projects:

```bash
npm run test:projects -- --apps=portal,payments --env=qa --profile=regression --project=chromium
```

Run project-specific environments:

```bash
npm run test:projects -- --apps=portal,payments --env-map=portal:qa,payments:uat --project=chromium
```

Run a configured customer group:

```bash
npm run test:projects -- --group=customer-a --profile=regression --project=chromium
```

Run every registered project:

```bash
npm run test:projects -- --all --env=qa --profile=regression --project=chromium
```

Preview without execution:

```bash
npm run test:projects -- --all --env=qa --dry-run --project=chromium
```

The default portfolio behavior continues after a project failure and returns a non-zero final status when any project failed. Use `--fail-fast` only when early termination is required.


## Frequent Git / GitHub CLI flow

For normal contribution work, the shortest safe sequence is:

```bash
git checkout main
git pull origin main
git checkout -b feature/<work>
# make changes
npm run validate:final
git diff --check
git add .
git commit -m "<type>: <message>"
git push -u origin feature/<work>
gh pr create --base main --head feature/<work> --title "<title>"
gh pr checks --watch
```

After merge, synchronize `main`, watch the main CI, and only then create a release tag when the change is a release. The full install/login/PR/CI/rerun/tag/cleanup/troubleshooting command reference is `40-GIT-GITHUB-CLI-TERMINAL-GUIDE.md`.

## v1.6.0 evidence / impact commands

Explain changed-code impact without silently narrowing CI:

```bash
npm run qa:impact -- --base main --head HEAD
# or
npm run qa:impact -- --files projects/demo/src/pages/todo.page.ts
```

Assess an existing Playwright suite in incremental migration slices:

```bash
npm run qa:migrate -- projects/<project>/tests
```

Run the seeded false-heal safety benchmark:

```bash
npm run test:healing:safety
```

After a normal business execution, open the business report and use **Verify dashboard claims** for one-click access to the Evidence Ledger.

