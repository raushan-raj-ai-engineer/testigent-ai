# Multi-Project and Customer Portfolio Execution

TestigentAI can execute a single application, an ad-hoc project subset, a reusable customer portfolio, or all registered projects from one repository.

## Discovery

Projects are discovered dynamically from:

```text
projects/<project>/config/*.json
```

There is no hard-coded application list in the multi-project runner. Adding a valid project automatically makes it available to `--all`.

## Commands

Single project:

```bash
APP=portal ENV=qa npm run test:project -- --project=chromium
```

Selected projects:

```bash
npm run test:projects -- --apps=portal,payments --env=qa --profile=regression --project=chromium
```

Mixed environments:

```bash
npm run test:projects -- --apps=portal,payments --env-map=portal:qa,payments:uat --project=chromium
```

All registered projects:

```bash
npm run test:projects -- --all --env=qa --profile=regression --project=chromium
```

Dry-run the plan:

```bash
npm run test:projects -- --all --env=qa --dry-run --project=chromium
```

## Customer groups

Optional reusable groups live in `config/project-groups.json`:

```json
{
  "groups": {
    "customer-a": {
      "description": "Customer A digital estate",
      "projects": ["portal", "payments", "claims"],
      "environments": {
        "portal": "qa",
        "payments": "uat",
        "claims": "qa"
      }
    }
  }
}
```

Run it with:

```bash
npm run test:projects -- --group=customer-a --profile=regression --project=chromium
```

CLI `--env` and `--env-map` values override group defaults.

## Failure behavior

The default is portfolio-complete execution: one failed project does not stop later projects. The runner returns a non-zero final exit code if any selected project fails.

Use `--fail-fast` only when early termination is preferred:

```bash
npm run test:projects -- --group=customer-a --fail-fast --project=chromium
```

## AI tests

AI-tagged tests stay denied by default unless the selected execution profile allows them or the portfolio command explicitly opts in:

```bash
AI_ENABLED=true AI_PROVIDER_MODE=single AI_PROVIDER=<approved-provider> \
  npm run test:projects -- --all --env=qa --profile=nightly --include-ai --project=chromium
```

`--include-ai` permits `@ai` selection and performs provider preflight before the portfolio starts. `AI_ENABLED=true` plus an approved provider/model/credential policy are required for a real run. Dry-run planning does not require secrets. Manual tests and review-blocked generated proposals are not enabled by this option.

## Reporting

Every project retains isolated reporting:

```text
reports/<APP>/business/business-report.json
reports/<APP>/playwright-html/
```

The portfolio runner also writes:

```text
reports/multi-project/summary.json
reports/multi-project/index.html
```

The JSON remains the deterministic source for CI. The HTML portfolio dashboard is business-first: estate health, selected/executed/not-applicable/blocked scenarios, quality failures, known-defect debt, CI blockers, validated healing, AI usage and drill-down links to each product report.
