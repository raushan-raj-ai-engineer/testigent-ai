# Known Defects and Troubleshooting

## Known AUT defects

Application bugs belong in `projects/<project>/known-defects.json`, not in reusable framework logic. The SDET Practice project currently tracks `SDET-DEL-001`: Delete does not remove the selected user in QA.

The associated test marks expected failure immediately before the affected Delete step. Create/Update regressions still fail normally. If Delete starts working, Playwright reports an unexpected pass, forcing the team to remove/resolve the stale known-defect entry.

Never weaken an assertion merely to make a real product defect green.

## Common commands

```bash
npm run validate:final
APP=<project> ENV=qa npm run project:check
APP=<project> ENV=qa npm run test:project -- --project=chromium
APP=<project> ENV=qa npm run report:open
```

### Missing auth

Run:

```bash
APP=<project> ENV=qa APPLICATION_EXPLORATION_ENABLED=true npm run app:auth
```

### Locator drift

Run headed/safe exploration, inspect evidence, update the project page object after review. Do not make the generic framework project-aware.

### Framework test fails but real dashboard works

Distinguish test harness limitations from production behavior. The framework dashboard regression uses explicit asset injection when HTML is loaded with `page.setContent`, while the HTTP dashboard test validates the real bundle.


## GitHub Actions / Git CLI troubleshooting

For workflow listing, failed-job logs, reruns, repository variables/secrets, branch tracking, tags and merged-branch cleanup, use `40-GIT-GITHUB-CLI-TERMINAL-GUIDE.md`. For the current certified workflow/run state, use `41-CURRENT-RELEASE-STATUS.md`.
