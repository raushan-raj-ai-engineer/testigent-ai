# Healing, AI and MCP

## 1. Healing order

The framework always attempts deterministic recovery before AI:

```text
Primary locator
  -> declared deterministic fallbacks
  -> semantically validated project-scoped healing cache
  -> configured AI provider(s), only when AI is explicitly enabled
  -> scope / uniqueness / confidence validation
  -> perform action
  -> verify declared business post-condition
  -> only validated recovery is counted/cached
```

Visibility and uniqueness prove only that a locator is actionable; they do **not** prove that it is the intended business element. Critical Page Object actions therefore provide a semantic post-condition such as "modal becomes visible", "dialog closes after save" or "expected row appears". Only a recovery whose post-condition passes is a successful self-heal.

Healing audit outcomes are `validated`, `rejected`, `suggested`, or `unverified`. Only `validated` recoveries contribute to the Self-healed KPI and source-maintenance candidates. Rejected attempts remain visible for diagnosis. Unverified runtime actions are never promoted into the reusable cache.

### Visible-match/cardinality policy

Locator safety is evaluated against **visible** matches, not raw DOM count. This matters for applications that keep hidden template or modal copies of controls in the DOM. By default every descriptor still requires exactly one visible match (`match: 'unique'`). A project may explicitly use `match: 'firstVisible'` only when duplicate visible controls are intentionally equivalent (for example two Create User entry points that perform the same action). Critical uses must keep a semantic post-condition so the selected control is trusted only after the intended business state transition occurs.

Do not use `firstVisible` as a generic way to silence strictness problems. If duplicate controls represent different business actions, add a better scope/role/name/test-id contract instead.

AI never replaces normal locator engineering. A cached or AI-produced locator must still pass scope, uniqueness and confidence checks before use. v1.2.2 intentionally ignores legacy cache entries that lack semantic-validation metadata, producing a safe one-time cache cold start after upgrade.

### Healing mode semantics (v1.2.4+)

- `HEALING_MODE=off`: primary locator only. Use this to prove the primary contract independently.
- `HEALING_MODE=suggest` (default): primary plus **reviewed deterministic fallbacks** may execute. Validated cache and AI remain non-automatic. This gives a fresh checkout resilient source-controlled selectors without requiring any LLM.
- `HEALING_MODE=runtime`: primary -> deterministic fallbacks -> semantically validated cache -> explicitly configured AI. Dynamic recovery still requires safety checks and critical actions still require the business post-condition before cache/report promotion.

Role descriptors may use `namePattern` / `namePatternFlags` for stable accessible-name families rather than enumerating cosmetic copy variants. Example: a project can treat Create User, Add User and New User as the same semantic entry point while the modal-visible post-condition proves that the selected control is actually correct.

When no safe candidate resolves, the framework emits `LOCATOR_RESOLUTION_FAILED` with a bounded summary of visible buttons/links/tabs/menuitems. This diagnostic is intentionally evidence-only; it does not weaken strictness or auto-click arbitrary controls.

## 2. AI is opt-in and provider-neutral

There is no implicit Ollama, Gemini, OpenAI or Azure OpenAI default. The person or CI environment running the framework chooses the provider.

AI disabled:

```env
AI_ENABLED=false
```

Result: primary -> fallbacks -> cache -> fail safely. No LLM call is made.

## 3. Single-provider mode

Use this when one provider should be used for the run.

### Local Ollama example

```env
AI_ENABLED=true
AI_PROVIDER_MODE=single
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.2
HEALING_AI_ENABLED=true
HEALING_MODE=runtime
```

Run:

```bash
npm run ai:check
npm run test:ai-healing
```

### Local or CI Gemini example

```env
AI_ENABLED=true
AI_PROVIDER_MODE=single
AI_PROVIDER=gemini
AI_ALLOW_CLOUD_EGRESS=true
GEMINI_API_KEY=<secret>
GEMINI_MODEL=gemini-3.8-flash
HEALING_AI_ENABLED=true
HEALING_MODE=runtime
```

Run:

```bash
npm run ai:check
npm run test:ai-healing
```

Never commit `GEMINI_API_KEY`. Local users keep it in `.env`; CI should inject it through the CI secret store.

### Other providers

The same pattern applies to `openai`, `azure-openai`, `anthropic`, `openai-compatible` and `http`. Vendor-specific credentials/models stay in environment variables; tests and page objects remain vendor-neutral.

## 4. Explicit failover mode

Failover is optional and must be intentionally configured.

```env
AI_ENABLED=true
AI_PROVIDER_MODE=failover
AI_PROVIDER_ORDER=ollama,gemini
AI_ALLOW_CLOUD_EGRESS=true
OLLAMA_MODEL=llama3.2
GEMINI_API_KEY=<secret>
GEMINI_MODEL=gemini-3.8-flash
```

The order is user-controlled, and every provider listed in failover mode must have its required configuration present. For example:

```text
AI_PROVIDER_ORDER=gemini,openai
Gemini -> OpenAI
```

or:

```text
AI_PROVIDER_ORDER=ollama,gemini
Ollama -> Gemini
```

The framework does not silently insert Ollama or any other provider. It also does not silently drop a misconfigured provider from an explicit failover order; configuration errors fail fast.

Provider failover occurs on provider/runtime error or no-result. Once a provider returns a concrete locator proposal, the chain stops and deterministic validation decides whether the proposal is safe. An unsafe proposal is rejected rather than being voted into acceptance by additional providers.

## 5. Cloud egress guard

Cloud AI providers require:

```env
AI_ALLOW_CLOUD_EGRESS=true
```

This prevents accidental transmission of redacted test evidence to an external provider. The framework still applies its redaction boundary before AI calls.

## 6. AI demo commands

Provider-neutral AI healing test (uses the provider already configured in the environment):

```bash
APP=demo ENV=qa npm run test:ai-healing
```

Convenience Ollama example:

```bash
npm run test:ai-healing:ollama
```

Convenience Gemini example (requires `GEMINI_API_KEY` and `GEMINI_MODEL` in `.env` or CI environment):

```bash
npm run test:ai-healing:gemini
```

Provider health only:

```bash
AI_ENABLED=true npm run ai:check
```

For Gemini, the health check performs a real Models API lookup, so an invalid key or unavailable model returns a failing health result instead of a configuration-only success.

## 7. CI pattern

Keep AI disabled by default in generic CI. Enable it only in the pipeline/job that is approved to use AI.

Gemini CI example variables:

```text
AI_ENABLED=true
AI_PROVIDER_MODE=single
AI_PROVIDER=gemini
AI_ALLOW_CLOUD_EGRESS=true
GEMINI_MODEL=gemini-3.8-flash
GEMINI_API_KEY=<CI secret>
```

Failover CI example:

```text
AI_ENABLED=true
AI_PROVIDER_MODE=failover
AI_PROVIDER_ORDER=gemini,openai
AI_ALLOW_CLOUD_EGRESS=true
GEMINI_API_KEY=<CI secret>
GEMINI_MODEL=gemini-3.8-flash
OPENAI_API_KEY=<CI secret>
OPENAI_MODEL=<approved model>
```

Do not hardcode keys in YAML.

## 8. MCP

MCP configuration remains independent of AI-provider selection. `.mcp.json`, `.vscode/mcp.json` and `.mcp/playwright.mcp.example.json` are integration examples. AI provider credentials do not belong in those committed files.


## 9. Runtime proof of provider/model usage

Every actual AI request writes operational metadata to:

```text
reports/<project>/ai/ai-audit.jsonl
```

By default the terminal also prints a concise line such as:

```text
[ai:healing] status=success provider=gemini model=gemini-3.8-flash latencyMs=842
```

Control file and terminal observability independently:

```env
AI_AUDIT_ENABLED=true
AI_RUNTIME_LOGGING=true
```

Set `AI_RUNTIME_LOGGING=false` to suppress terminal lines while retaining report evidence. Set `AI_AUDIT_ENABLED=false` only when your organization intentionally does not want local AI operational evidence persisted. It intentionally excludes prompts, accessibility snapshots, keys and raw model output. The business dashboard and executive summary show actual provider/model usage from runtime evidence.

## 10. Playwright Test Agents for authoring

The framework supports Playwright planner, generator and healer agents for new-test development. Generate only the coding-agent loop your team actually uses:

```bash
PLAYWRIGHT_AGENT_LOOP=vscode npm run agents:init
npm run agents:check
```

Then start a requirement workspace:

```bash
APP=my-project ENV=qa npm run test:new -- projects/my-project/requirements/feature.md --mode=agents
```

See `16-PLAYWRIGHT-AGENTS-PRODUCTIVITY.md` for the full planner -> generator -> healer -> human-review workflow and measurable productivity reporting.


## 11. Standalone MCP is environment-configurable

`npm run mcp:start` loads `.env` and passes `PLAYWRIGHT_MCP_*` variables to the standalone Playwright MCP server. Example:

```env
PLAYWRIGHT_MCP_ISOLATED=true
PLAYWRIGHT_MCP_HEADLESS=false
PLAYWRIGHT_MCP_PORT=8931
PLAYWRIGHT_MCP_OUTPUT_MODE=stdout
```

This is separate from the Playwright **Test MCP** server in `.mcp.json`/agent definitions. Use standalone MCP for persistent exploratory browser workflows; Test MCP is the tool surface used by Playwright Test Agents.


## Runtime healing vs source healing

Runtime healing is execution resilience only: it validates a replacement locator **and the declared business post-condition** before recording a successful recovery or promoting AI output to cache. Rejected/suggested/unverified attempts remain audit evidence but never become maintenance candidates. Repeated validated recovery evidence is converted into a review-only maintenance candidate with `npm run qa:heal`. Playwright healer/CLI may then verify LocatorPlan/scoping/synchronization changes, but it must never weaken business/API/DB/security expectations or add skip/fixme to hide a defect.
