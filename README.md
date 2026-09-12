# TestigentAI — Intelligent Quality Engineering Platform

A multi-project, provider-neutral Playwright + TypeScript quality engineering platform for UI, API, database, data-driven and AI/agent quality with project-scoped reporting, governed self-healing, declarative authoring, optional AI/MCP tooling and CI/CD support.

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

## Install and select a project

```bash
npm ci
npx playwright install chromium
npm run qa:use -- <project> <environment>
npm run qa:doctor
```

Local selection is stored in gitignored `.runtime/workspace.json`. CI must provide `APP` and `ENV` explicitly; reusable runtime code has no silent `demo/qa` fallback.


## V6 product architecture

V6 adds execution profiles, organization/project/environment/runtime policy layering, percentage workers, capability-aware auth, parallel-safe data identities, JSON/CSV/YAML/Excel case parameterization, duration history/balancing, governed declarative scenarios, visual/accessibility/performance lanes, and a provider-neutral AI-evaluation contract.

```bash
APP=demo ENV=qa TEST_PROFILE=regression PW_WORKERS=50% npm run test:project -- --project=chromium
APP=demo ENV=qa npm run test:db
APP=demo ENV=qa npm run scale:audit
```

Read `docs/19-MARKET-COMPETITIVE-RESEARCH-2026.md`, `docs/20-V6-DATA-PARALLEL-EXECUTION.md`, `docs/21-QUALITY-LANES-AND-DECLARATIVE-AUTHORING.md`, and `docs/22-COMPETITIVE-BENCHMARK-PLAN.md`.

## v1.3.x generic authentication lifecycle

Authenticated projects can opt into a reusable auth lifecycle without putting project login logic in framework core. `src/framework` owns freshness checks, single-flight locking, fresh-context verification, atomic state promotion and safe navigation-boundary recovery; `projects/<project>/auth/` owns only the application-specific login/refresh implementation.

```bash
APP=<project> ENV=qa npm run auth:check
APP=<project> ENV=qa npm run auth:prepare
APP=<project> ENV=qa npm run test:project -- --project=chromium
```

`test:project` automatically prepares required browser auth before Playwright workers start. If a known token expiry approaches during a run, the framework may refresh before the next framework-owned action or at a navigation boundary. It never blindly replays mutating clicks/submits. See `docs/28-AUTH-LIFECYCLE-AUTO-REFRESH.md`.

`v1.3.1` fixes the bundled SDET Practice demo-provider username casing and adds a deterministic provider request contract test. `v1.3.2` hardens release validation: all reusable exports again satisfy the JSDoc contract and `npm run validate:final` works on a clean checkout without requiring a saved APP/ENV selection. Runtime project selection remains explicit. `v1.3.3` fixes the release-gate environment scope so the entire validation chain—including scenario doctor—runs in the deterministic bundled `demo/qa` release context, while normal runtime commands still require explicit project selection. `v1.3.4` closes the remaining framework regressions exposed by the clean release run: the dashboard Reset Filters control is restored, MIME preview assertions tolerate standards-compliant quoted-printable folding, and requirement-intelligence fixtures now model initialized project fixtures required by the generator safety guard. `v1.3.5` aligns the last three stale framework assertions with current contracts: business skipped scenarios render as Blocked, explicit-new-app resolution is asserted before project bootstrap, and generated tests are expected to import the project-owned fixture rather than the legacy enterprise fixture.

## Daily use

New joiners use the thin `qa:*` surface:

```bash
npm run qa:status
# auth-required projects only; normally non-interactive when lifecycle autoRefresh is configured:
npm run auth:prepare
# manual fallback / MFA-assisted local capture:
npm run qa:auth
npm run qa:new -- <requirement-id-or-file>
npm run qa:test -- --project=chromium
npm run qa:validate
npm run qa:report
npm run qa:heal
```

Auth state is verified in a fresh browser context before promotion. Auto-refresh providers are project-owned, auth files stay gitignored, and sessionStorage is restored through a companion state file when needed. Expired auth is recovered at safe navigation boundaries only; locator healing never treats a login page as selector drift.

Normal business specs consume project `app`, `api`, `repositories` and data fixtures. Page mechanics stay in Page Objects/LocatorPlans, business journeys stay in workflows, and reusable engines stay under `src/framework`. `npm run architecture:check` prevents ordinary specs from bypassing these boundaries.

For CI/one-off execution use explicit selection, for example `APP=demo ENV=qa npm run test:project -- --project=chromium`.


## v1.2.9 failure-evidence de-duplication

Business dashboards show the primary failure screenshot once, directly under the failed `test.step()`. The scenario evidence pane then shows only additional artifacts such as video, trace, logs, or error context, avoiding duplicate screenshots while preserving technical evidence.

## v1.2.8 merged CI reporting and evidence

Business reporting now separates **Selected**, **Applicable**, **Executed**, **Not applicable** and **Blocked** scenarios. Execution coverage is `Executed / Applicable`, so an optional disabled capability such as DB does not falsely lower coverage or appear in executed layer coverage.

CI produces one authoritative merged report: normal shards exclude `@ai`, the dedicated AI/healing lane owns AI scenarios, duplicate scenario IDs fail the merge, and healing/AI audit facts are merged once. Failed UI scenarios attach a framework screenshot through Playwright; the business report shows that screenshot directly under the failed `test.step()` while retained video/trace/text evidence remains linked. See `docs/27-CI-MERGED-REPORTING-AND-EVIDENCE.md`.

## v1.2.7 reporting validation hotfix

The mail-notification regression fixture now derives facts through the canonical `buildExecutionFacts()` pipeline instead of manually duplicating the `ExecutionFacts` schema. This keeps email validation aligned with the business outcome model and explicitly distinguishes quality pass rate from execution coverage.

## v1.2.6 platform status: resilient authentication, semantic healing and business-standard reporting

Runtime healing now distinguishes **locator actionability** from **business success**. Critical healed actions can declare a semantic post-condition (for example, "Create User modal becomes visible"). Only recoveries whose post-condition passes are counted as self-healed or written to the reusable healing cache. Rejected, suggested and unverified attempts remain auditable in reports but cannot pollute the cache or inflate healing KPIs.

Locator resolution is also visibility-aware. The framework evaluates cardinality against visible elements rather than raw DOM count, so hidden template/modal duplicates do not create false ambiguity. `unique` remains the default safety policy; projects may opt into `match: 'firstVisible'` only when duplicate visible controls are intentionally equivalent and the action is protected by a business post-condition.

The v1.2.2+ cache intentionally ignores pre-semantic entries because older cache records were created before business post-condition validation existed. This causes a safe one-time cache cold start after upgrade.

v1.2.4+ also makes deterministic recovery useful on a fresh checkout without turning AI on: `HEALING_MODE=off` means primary only, `suggest` means primary plus reviewed source-controlled fallbacks while cache/AI remain suggestion-only, and `runtime` enables validated cache plus configured AI. Role descriptors may use `namePattern` for stable accessible-name families such as Create/Add/New User. When resolution still fails, the error/log includes a bounded summary of visible interactive controls so locator drift is diagnosable from CI evidence instead of a generic failure. See `docs/07-HEALING-AI-MCP.md`.


### v1.2.5 authentication guard

Required storage-state projects now verify authentication as a business precondition rather than trusting that an auth file merely exists. `qa:auth` captures cookies/localStorage plus sessionStorage, proves the captured state in a second fresh browser context, and only then promotes it. Project auth verification stays configurable under `projects/<project>/config/<env>.json`. Normal authenticated navigation fails with `AUTH_SESSION_INVALID` before healing if the session resolves to a login page, preventing authentication failures from being misclassified as locator failures.


## v1.2.6 business-standard reporting

The business dashboard now distinguishes **product quality** from **CI blocking**. Registered known defects are reported as `KNOWN_DEFECT`: they count in **Quality failed** but remain non-blocking when explicitly accepted. Unexpected failures and unexpected passes remain CI-blocking signals. The executive dashboard separates new failures, accepted defect debt, flaky/retry debt, slow scenarios, validated healing and execution coverage, while Playwright HTML/trace remains the technical evidence layer.

```text
Quality failed     = KNOWN_DEFECT + FAILED
CI-blocking issues = FAILED + UNEXPECTED_PASS
```

This same outcome model is used by the interactive dashboard, JSON, CSV, email/static report, executive summary, merged CI reporting, terminal summary and history trend. See `docs/26-BUSINESS-REPORTING-STANDARD-2026.md`.


Reporting semantics are protected by an executable contract gate:

```bash
npm run reporting:contract
```

This gate also runs inside `npm run qa:validate`. It verifies that known defects remain quality failures but non-blocking when explicitly accepted, while unexpected failures and unexpected passes remain CI-blocking attention items.

## Release validation

See [`docs/12-RELEASE-VALIDATION.md`](docs/12-RELEASE-VALIDATION.md). The release gate is `npm run validate:final`.


## Team onboarding and AI/agent governance

- Root/local-state guide: `docs/14-ROOT-FOLDERS-AND-LOCAL-STATE.md`
- New-project handoff: `docs/15-NEW-PROJECT-HANDOFF.md`
- Playwright agents + productivity: `docs/16-PLAYWRIGHT-AGENTS-PRODUCTIVITY.md`
- Deep review: `docs/17-DEEP-REVIEW-2026.md`

## GitHub Actions Variables and Secrets

TestigentAI uses:

* **GitHub Variables** for non-sensitive configuration.
* **GitHub Secrets** for API keys, passwords, tokens, and credentials.

Configure them from:

`Repository → Settings → Secrets and variables → Actions`

---

## 1. Required GitHub Variables — Current Gemini Setup

Create the following under:

`Settings → Secrets and variables → Actions → Variables`

```text
APP=demo
ENV=qa

AI_CI_ENABLED=true

AI_PROVIDER_MODE=single
AI_PROVIDER=gemini
AI_ALLOW_CLOUD_EGRESS=true

GEMINI_MODEL=gemini-3.8-flash

AI_TIMEOUT_MS=60000
AI_MAX_CALLS_PER_TEST=2

AI_TEST_TIMEOUT_MS=120000
AI_NAVIGATION_TIMEOUT_MS=60000

BUSINESS_EMAIL_ENABLED=false
```

### Variable Details

**APP**

```text
Value: demo
```

Default project located under:

```text
projects/demo
```

For another project, for example:

```text
APP=sdet-practice
```

The manual GitHub workflow input can override this value.

---

**ENV**

```text
Value: qa
```

Defines the project environment.

Example:

```text
projects/demo/config/qa.json
```

Other possible environments can include:

```text
dev
qa
uat
stage
prod
```

depending on the project configuration.

---

**AI_CI_ENABLED**

```text
Value: true
```

Controls whether the AI validation job automatically runs in CI.

```text
true  = run AI validation automatically
false = AI validation only runs when manually requested
```

Recommended:

```text
AI_CI_ENABLED=true
```

---

**AI_PROVIDER_MODE**

```text
Value: single
```

Controls AI provider selection.

Supported design:

```text
single
failover
```

Current configuration:

```text
AI_PROVIDER_MODE=single
```

---

**AI_PROVIDER**

```text
Value: gemini
```

Defines the AI provider used when provider mode is `single`.

Current configuration:

```text
AI_PROVIDER=gemini
```

---

**AI_PROVIDER_ORDER**

Not required for the current Gemini-only configuration.

Leave it empty.

Example future failover configuration:

```text
AI_PROVIDER_MODE=failover
AI_PROVIDER_ORDER=gemini,openai,anthropic
```

Providers should be attempted in exactly the configured order.

---

**AI_ALLOW_CLOUD_EGRESS**

```text
Value: true
```

Allows TestigentAI to send approved AI requests to a cloud AI provider.

Gemini requires:

```text
AI_ALLOW_CLOUD_EGRESS=true
```

For completely local AI execution this can normally remain:

```text
false
```

---

**GEMINI_MODEL**

```text
Value: gemini-3.8-flash
```

Defines the Gemini model used by TestigentAI.

Current configuration:

```text
GEMINI_MODEL=gemini-3.8-flash
```

---

**AI_TIMEOUT_MS**

```text
Value: 60000
```

Maximum time allowed for one AI provider request.

```text
60000 ms = 60 seconds
```

Recommended for GitHub-hosted CI:

```text
AI_TIMEOUT_MS=60000
```

Do not hardcode this timeout inside tests.

---

**AI_MAX_CALLS_PER_TEST**

```text
Value: 2
```

Limits how many AI requests a single test can make.

Recommended:

```text
AI_MAX_CALLS_PER_TEST=2
```

This protects against:

```text
uncontrolled AI retries
excessive provider usage
unexpected API cost
runaway healing loops
```

---

**AI_TEST_TIMEOUT_MS**

```text
Value: 120000
```

Maximum Playwright timeout for the complete AI validation test.

```text
120000 ms = 120 seconds
```

It must remain greater than the individual AI provider timeout.

Recommended relationship:

```text
AI_TIMEOUT_MS=60000
AI_TEST_TIMEOUT_MS=120000
```

---

**AI_NAVIGATION_TIMEOUT_MS**

```text
Value: 60000
```

Maximum navigation time for AI-enabled browser tests running in CI.

```text
60000 ms = 60 seconds
```

This is useful because GitHub-hosted runners and external applications can be slower than local execution.

---

**BUSINESS_EMAIL_ENABLED**

For now:

```text
Value: false
```

Recommended current configuration:

```text
BUSINESS_EMAIL_ENABLED=false
```

Change it to:

```text
true
```

only after SMTP configuration has been completed.

---

## 2. Required GitHub Secret — Current Gemini Setup

Create this under:

`Settings → Secrets and variables → Actions → Secrets`

### GEMINI_API_KEY

```text
Name:
GEMINI_API_KEY

Value:
<your-real-gemini-api-key>
```

The real key must never be stored in:

```text
README.md
.env.example
source code
workflow YAML
Git history
release ZIP
```

The workflow accesses it securely using:

```text
${{ secrets.GEMINI_API_KEY }}
```

---

## 3. Current Minimum Configuration

For the current TestigentAI + Gemini setup, these are the settings that should exist in GitHub.

### Variables

```text
APP=demo
ENV=qa

AI_CI_ENABLED=true

AI_PROVIDER_MODE=single
AI_PROVIDER=gemini

AI_ALLOW_CLOUD_EGRESS=true

GEMINI_MODEL=gemini-3.8-flash

AI_TIMEOUT_MS=60000
AI_MAX_CALLS_PER_TEST=2

AI_TEST_TIMEOUT_MS=120000
AI_NAVIGATION_TIMEOUT_MS=60000

BUSINESS_EMAIL_ENABLED=false
```

### Secrets

```text
GEMINI_API_KEY=<configured securely in GitHub>
```

That is sufficient for the current Gemini CI configuration.

---

## 4. Optional OpenAI Configuration

Only create these if OpenAI is actually used.

### Variable

```text
OPENAI_MODEL=<configured-openai-model>
```

### Secret

```text
OPENAI_API_KEY=<openai-api-key>
```

Do not create them just because the workflow supports OpenAI.

---

## 5. Optional Azure OpenAI Configuration

Only create these when Azure OpenAI is used.

### Variables

```text
AZURE_OPENAI_ENDPOINT=<azure-openai-endpoint>
AZURE_OPENAI_MODEL=<azure-deployment-or-model>
```

### Secret

```text
AZURE_OPENAI_API_KEY=<azure-openai-api-key>
```

---

## 6. Optional Anthropic Configuration

Only create these when Anthropic is used.

### Variable

```text
ANTHROPIC_MODEL=<anthropic-model>
```

### Secret

```text
ANTHROPIC_API_KEY=<anthropic-api-key>
```

---

## 7. Optional OpenAI-Compatible Provider

For providers exposing an OpenAI-compatible API:

### Variables

```text
AI_COMPAT_BASE_URL=<provider-base-url>
AI_COMPAT_MODEL=<provider-model>
```

### Secret

```text
AI_COMPAT_API_KEY=<provider-api-key>
```

---

## 8. Optional Generic AI Provider

For a custom HTTP-based AI provider:

### Variables

```text
AI_ENDPOINT=<custom-ai-endpoint>
AI_MODEL=<custom-model>
```

### Secret

```text
AI_API_KEY=<custom-provider-api-key>
```

---

## 9. Future Multi-Provider Failover

Current Gemini-only configuration:

```text
AI_PROVIDER_MODE=single
AI_PROVIDER=gemini
```

Future failover example:

```text
AI_PROVIDER_MODE=failover

AI_PROVIDER_ORDER=gemini,openai,anthropic
```

Example behavior:

```text
Gemini
   ↓ unavailable/error/no-result
OpenAI
   ↓ unavailable/error/no-result
Anthropic
```

Provider order must be respected exactly as configured.

---

## 10. Timeout Policy

TestigentAI timeouts are configuration-driven and must not be hardcoded inside project tests.

Recommended CI values:

```text
AI_TIMEOUT_MS=60000

AI_TEST_TIMEOUT_MS=120000

AI_NAVIGATION_TIMEOUT_MS=60000
```

Relationship:

```text
AI provider request
       |
       | maximum 60 seconds
       v
AI candidate / no-result
       |
       v
validation + browser action + reporting
       |
       | complete test maximum 120 seconds
       v
Test finished
```

This leaves enough time for:

```text
AI provider response
locator validation
browser interaction
screenshots
video
trace
business reporting
AI audit
cleanup
```

---

## 11. Optional Stakeholder Email Configuration

Keep email disabled until SMTP setup is complete:

```text
BUSINESS_EMAIL_ENABLED=false
```

When email delivery is required, change it to:

```text
BUSINESS_EMAIL_ENABLED=true
```

Then create the following GitHub Secrets:

```text
MAIL_FROM=<sender-email>

MAIL_TO=<stakeholder-email>

SMTP_HOST=smtp.gmail.com

SMTP_PORT=587

SMTP_USER=<gmail-account>

SMTP_PASS=<gmail-app-password>
```

For Gmail, use an approved **App Password** rather than storing the normal Gmail password.

---

## 12. Security Rules

Never commit:

```text
API keys
SMTP passwords
access tokens
credentials
authentication secrets
private endpoints containing credentials
```

Sensitive values belong in:

```text
GitHub Actions → Secrets
```

Non-sensitive configuration belongs in:

```text
GitHub Actions → Variables
```

Local secrets belong in:

```text
.env
```

The `.env` file must remain ignored by Git.

AI audit/reporting may safely capture information such as:

```text
provider
model
status
purpose
latency
healing result
```

but must never capture:

```text
API key
access token
password
raw secret
authorization header
```

---

## 13. Current TestigentAI CI Flow

```text
GitHub Push / Manual Run
          |
          v
Framework Validation
AI disabled
          |
          +-----------------------+
          |                       |
          v                       v
Normal Regression          AI Validation
2 Playwright shards        Gemini
@ai excluded               @ai only
          |                       |
          |                       |
          +-----------+-----------+
                      |
                      v
             Merge All Reports
                      |
          +-----------+-----------+
          |                       |
          v                       v
Playwright Report       Business Dashboard
Normal + AI             Normal + AI + Audit
          |                       |
          +-----------+-----------+
                      |
                      v
        ONE TestigentAI Final Artifact
```

AI_ALLOW_CLOUD_EGRESS       true
AI_CI_ENABLED               true
AI_MAX_CALLS_PER_TEST       2
AI_NAVIGATION_TIMEOUT_MS    60000
AI_PROVIDER                 gemini
AI_PROVIDER_MODE            single
AI_TEST_TIMEOUT_MS          120000
AI_TIMEOUT_MS               60000
APP                         demo
BUSINESS_EMAIL_ENABLED      false
ENV                         qa
GEMINI_MODEL                gemini-3.8-flash
## Schema-driven declarative UI authoring

TestigentAI v1.2.0 includes a governed low-code YAML layer for simple linear UI business flows. Authors do not need to memorize the DSL: run `npm run scenario:help`, scaffold with `npm run scenario:new`, receive JSON-Schema-driven VS Code completion/validation, preflight with `npm run scenario:validate`, and execute one scenario with `npm run scenario:run`. Complex control flow, cross-layer UI/API/DB orchestration, advanced browser behavior, and AI evaluation remain code-first TypeScript concerns.

See `docs/24-DECLARATIVE-AUTOMATION-GUIDE.md` for the user guide and `docs/23-DECLARATIVE-AUTHORING-DEEP-RESEARCH.md` for the research/design rationale.

## v1.2.1 database capability gating

Database execution is resolved centrally rather than inside project specs. Each project declares whether database validation is required in `projects/<project>/project.json`, while each environment declares the database type in `projects/<project>/config/<env>.json`. Secret connection values remain external (`DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`); `DB_TYPE` is only an explicit runtime override.

Tag any scenario that requires database access with `@db`. When DB is optional and unavailable, the enterprise automatic capability fixture skips only those `@db` scenarios with a clear reason. When DB is required and unavailable, `qa:doctor`, framework health and project preflight fail before execution. Normal project specs must not read `DB_*` variables or implement their own DB skip logic.
