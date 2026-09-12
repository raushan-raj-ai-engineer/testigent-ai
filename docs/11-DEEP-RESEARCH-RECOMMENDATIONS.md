# Deep Research Recommendations Implemented

## Executive conclusion

The framework should be treated as a reusable quality platform with explicit project ownership boundaries, not as one large Page Object Model repository. The reusable layer supplies infrastructure and policy; each product/application owns its selectors, workflows, API domains, database repositories, datasets, requirements, authentication policy and tests. This is the central design implemented in this release.

## 1. Fixtures are the reusable composition boundary

Playwright fixtures are isolated and composable. The framework therefore exposes generic capabilities from `src/framework/core/fixtures/enterprise.fixture.ts`, while each project extends that fixture in `projects/<project>/fixtures/test.fixture.ts`. This avoids a shared “god facade” that imports every application and prevents project teams from coupling their code to one another.

Source: Playwright, Fixtures — https://playwright.dev/docs/test-fixtures

## 2. Repository projects and Playwright projects solve different problems

Repository folders under `projects/<project>` express application/team ownership. Playwright `projects` in `playwright.config.ts` remain appropriate for browser/config execution variants such as Chromium and Firefox. Keeping these concepts separate makes onboarding predictable and avoids multiplying browser projects for every business application.

Source: Playwright, Projects — https://playwright.dev/docs/test-projects

## 3. Authentication must be project-owned and protected

Playwright recommends reusing authenticated browser state where appropriate and explicitly warns that storage-state files can contain impersonation-capable credentials. The implementation therefore keeps storage state under ignored local paths, stores the desired path in project configuration, and makes the generic runner fail preflight with a clear authentication instruction when required state is missing. A project that does not require auth has `strategy: none` and never attempts to open a nonexistent auth file.

For suites that mutate shared server state in parallel, separate accounts/per-worker auth are preferred over one shared account.

Source: Playwright, Authentication — https://playwright.dev/docs/auth

## 4. Deterministic-first healing is safer than silent locator mutation

Playwright’s locator model favors user-facing semantics and auto-waiting/web-first assertions. The framework keeps project selectors in page objects, tries deterministic locators first, and makes healing policy explicit. Suggest mode does not silently change a failing test. Runtime fallback is a diagnostic/controlled execution option, not a reason to leave stale project locators unreviewed.

Sources: Playwright, Locators — https://playwright.dev/docs/locators ; Playwright, Auto-waiting — https://playwright.dev/docs/actionability

## 5. API and database infrastructure should be generic; domain behavior should not

HTTP transport, auth headers, request observation, DB connections and readers are reusable infrastructure. Endpoint paths, payload rules, SQL and business repositories belong to each project. This boundary makes the core portable to Project2 without inheriting Demo or SDET Practice assumptions.

Source: Playwright, API testing — https://playwright.dev/docs/api-testing

## 6. Distributed CI should merge before publishing

Playwright blob reports are designed to support merging distributed/sharded executions. The CI templates therefore shard the selected project, collect technical blob and business bundles, merge them once, validate the final dashboard and only then publish/send an optional stakeholder notification. Project execution roots are isolated under `reports/<APP>/<ENV>/<RUN_ID>`.

Sources: Playwright, Reporters — https://playwright.dev/docs/test-reporters ; Playwright, CI — https://playwright.dev/docs/ci

## 7. Shared-resource serialization should be narrow

Playwright 1.63 test locks allow only tests sharing a named resource to serialize while unrelated tests continue in parallel. The repository retains a framework contract example for this pattern rather than globally disabling parallel execution when one account/resource is unsafe for concurrent mutation.

Source: Playwright, Release notes — https://playwright.dev/docs/release-notes

## 8. Secrets are environment inputs, never repository configuration

Azure DevOps guidance says not to store secrets in pipeline YAML, not to echo them, and to prefer protected variables/variable groups/Key Vault. GitHub supports repository, organization and environment secrets with explicit workflow access. The final templates contain no credential values and document secret injection as an environment concern.

Sources: Microsoft Learn, Secrets in pipelines — https://learn.microsoft.com/en-us/azure/devops/pipelines/security/secrets?view=azure-devops ; Microsoft Learn, Azure Key Vault secrets — https://learn.microsoft.com/en-us/azure/devops/pipelines/release/azure-key-vault?view=azure-devops ; GitHub Docs, Secrets — https://docs.github.com/en/actions/concepts/security/secrets

## 9. Product defects must not be “fixed” in automation

A real application defect was observed in SDET Practice: Delete does not remove the selected user. The framework keeps the assertion intact and records the bug in `projects/sdet-practice/known-defects.json`. Expected-failure activation occurs only immediately before the affected Delete step. Create or Update regressions still fail unexpectedly; when Delete is fixed, Playwright reports an unexpected pass, forcing the known-defect marker to be reviewed.

This separates platform health from product health without hiding either.

## 10. Dependency scanning needs accountable exceptions, not blanket ignores

The repository vendors SheetJS `xlsx@0.20.3`. Upstream SheetJS security documentation should be consulted when scanners report findings against registry metadata. The `security:check` command blocks every HIGH/CRITICAL finding unless that exact advisory ID, package and affected range has an approved exception in `config/security-exceptions.json` with rationale, owner and expiry. No package/version-wide exception is inherited by future advisories; unresolved high/critical advisory chains fail closed.

Source: SheetJS, Security — https://docs.sheetjs.com/docs/miscellany/security/

## Resulting operating model

A new team creates `projects/project2` from the template, edits only its own environment/config/data/domain automation, and consumes the already-tested reusable core. Framework changes should be rare and reviewed as platform changes. Project changes should not require modifications to sibling projects. `npm run architecture:check` protects that boundary continuously.
