# Healing, AI and MCP

## 1. Healing order

The framework always attempts deterministic recovery before AI:

```text
Primary locator
  -> declared deterministic fallbacks
  -> validated project-scoped healing cache
  -> configured AI provider(s), only when AI is explicitly enabled
  -> deterministic safety validation of the AI proposal
  -> runtime use or suggestion according to HEALING_MODE
  -> cache only a validated runtime result
```

AI never replaces normal locator engineering. A cached or AI-produced locator must still pass scope, uniqueness and confidence checks before use.

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
