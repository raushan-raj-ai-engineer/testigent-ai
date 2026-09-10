# AI Provider Examples

This is a copy/paste reference for new framework users.

## No AI

```env
AI_ENABLED=false
```

## Ollama only (local)

```env
AI_ENABLED=true
AI_PROVIDER_MODE=single
AI_PROVIDER=ollama
OLLAMA_MODEL=llama3.2
HEALING_AI_ENABLED=true
HEALING_MODE=runtime
```

## Gemini only (local or CI)

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

## OpenAI only

```env
AI_ENABLED=true
AI_PROVIDER_MODE=single
AI_PROVIDER=openai
AI_ALLOW_CLOUD_EGRESS=true
OPENAI_API_KEY=<secret>
OPENAI_MODEL=<approved model>
```

## Azure OpenAI only

```env
AI_ENABLED=true
AI_PROVIDER_MODE=single
AI_PROVIDER=azure-openai
AI_ALLOW_CLOUD_EGRESS=true
AZURE_OPENAI_ENDPOINT=<endpoint>
AZURE_OPENAI_API_KEY=<secret>
AZURE_OPENAI_MODEL=<deployment/model>
```

## Gemini -> OpenAI failover

```env
AI_ENABLED=true
AI_PROVIDER_MODE=failover
AI_PROVIDER_ORDER=gemini,openai
AI_ALLOW_CLOUD_EGRESS=true
GEMINI_API_KEY=<secret>
GEMINI_MODEL=gemini-3.8-flash
OPENAI_API_KEY=<secret>
OPENAI_MODEL=<approved model>
```

## Ollama -> Gemini failover

```env
AI_ENABLED=true
AI_PROVIDER_MODE=failover
AI_PROVIDER_ORDER=ollama,gemini
AI_ALLOW_CLOUD_EGRESS=true
OLLAMA_MODEL=llama3.2
GEMINI_API_KEY=<secret>
GEMINI_MODEL=gemini-3.8-flash
```

## Commands

```bash
npm run ai:check
npm run ai:demo
npm run test:ai-healing
npm run test:ai-healing:ollama
npm run test:ai-healing:gemini
```

`test:ai-healing` does not choose a provider. It uses the provider configuration supplied by the user or CI environment. Every explicitly selected/listed provider must be fully configured; missing configuration fails fast. Because this command explicitly requests the AI demo, missing provider configuration is treated as a failure rather than a skipped/false-green AI test.


## Ready-to-copy example files

- `config/examples/ai-ollama.env.example` — local Ollama single-provider setup.
- `config/examples/ai-gemini.env.example` — Gemini single-provider setup for local or CI.
- `config/examples/ai-failover.env.example` — explicit Ollama -> Gemini failover example.

Copy only the settings you need into `.env`; do not commit `.env` or real provider keys.
