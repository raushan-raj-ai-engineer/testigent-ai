# Root Folders and Local State

This guide explains every non-obvious root folder so teams know what belongs in source control, what is generated locally, and what can be safely cleaned.

| Path | Keep in repository? | Purpose | Safe cleanup rule |
|---|---|---|---|
| `.github/` | Yes | CI workflows plus repository-level GitHub/VS Code agent definitions. | Keep. |
| `.vscode/` | Yes | VS Code MCP configuration example for Playwright Test MCP. | Keep when VS Code is supported by the team. |
| `.mcp.json` | Yes | Playwright **Test MCP** server used by planner/generator/healer agent definitions (`playwright run-test-mcp-server`). | Keep. |
| `.mcp/` | Yes | Standalone `@playwright/mcp` browser-server example for persistent exploratory MCP workflows. | Keep; contains no secrets. |
| `agent-prompts/` | Yes | Framework guardrails supplied to coding agents so generated tests follow Page Object/healing/review rules. | Keep. |
| `.healing/` | No; generated | Project-scoped validated locator cache. Created during runtime healing. | `npm run clean` removes it. Never share it as framework source. |
| `.runtime/` | No; generated | Current run identity and active authoring-productivity session state. | `npm run clean`; never commit. |
| `.auth/` | No; generated/sensitive | Playwright storage state captured for authenticated projects. | `npm run clean:all`; never commit/share. |
| `.report-history/` | No; generated | Local dashboard trend history. | `npm run clean:all` when resetting local history. |
| `.application-knowledge/` | No; generated/reviewed | Learned application evidence used by requirement intelligence. Approved exports should be shared intentionally, not the local working store. | `npm run clean:all`. |
| `.proposal-backups/` | No; generated | Rollback copies created during proposal promotion. | `npm run clean:all`. |
| `reports/` | No; generated | Technical/business dashboards, AI audit evidence, productivity reports. | `npm run clean`. Publish as CI artifact when required. |
| `test-results/` | No; generated | Playwright screenshots/video/traces and raw test output. | `npm run clean`. |
| `.playwright-cli/` | No; generated | Temporary Playwright CLI session state. | `npm run clean`. |

## Why `.claude`, `.codex`, and `.opencode` are not shipped

Playwright's agent definitions are version-sensitive and should be regenerated after Playwright upgrades. The release therefore does not carry three extra tool-specific root trees. Generate only the client your team uses:

```bash
PLAYWRIGHT_AGENT_LOOP=codex npm run agents:init
# or
npm run agents:init -- claude
npm run agents:init -- opencode
```

The repository keeps `.github/agents` as the ready-to-use VS Code/GitHub Copilot example because `.github` is already required for CI. Other loops are opt-in.

## Cleanup

Routine cleanup:

```bash
npm run clean
```

Deep cleanup, including auth and learned local state:

```bash
npm run clean:all
```

Never run deep cleanup before exporting authentication/knowledge evidence that you intentionally need to preserve locally.


Tool-specific generated agent folders (`.claude/`, `.codex/`, `.opencode/`) are gitignored. They can be regenerated for each user and are not part of the portable framework baseline.
