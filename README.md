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

## Install and validate

```bash
npm ci
npx playwright install chromium
npm run validate:final
```


## V6 product architecture

V6 adds execution profiles, organization/project/environment/runtime policy layering, percentage workers, capability-aware auth, parallel-safe data identities, JSON/CSV/YAML/Excel case parameterization, duration history/balancing, governed declarative scenarios, visual/accessibility/performance lanes, and a provider-neutral AI-evaluation contract.

```bash
APP=demo ENV=qa TEST_PROFILE=regression PW_WORKERS=50% npm run test:project -- --project=chromium
APP=demo ENV=qa npm run test:db
APP=demo ENV=qa npm run scale:audit
```

Read `docs/19-MARKET-COMPETITIVE-RESEARCH-2026.md`, `docs/20-V6-DATA-PARALLEL-EXECUTION.md`, `docs/21-QUALITY-LANES-AND-DECLARATIVE-AUTHORING.md`, and `docs/22-COMPETITIVE-BENCHMARK-PLAN.md`.

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