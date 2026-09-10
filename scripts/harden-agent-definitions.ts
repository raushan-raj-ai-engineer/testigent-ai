import fs from 'node:fs';
import path from 'node:path';

const marker = 'ENTERPRISE PLAYWRIGHT FRAMEWORK OVERLAY';
const overlay = `\n\n# ${marker}\n- Treat the repository's generated PLAYWRIGHT_AUTHORING_PROMPT.md and agent-prompts/framework-test-generation.md as mandatory architecture policy.\n- Application UI mechanics belong in projects/<project>/src/pages and must use LocatorPlan + HealingOrchestrator; do not put raw page.click/fill/locator actions in business specs.\n- Business journeys belong in projects/<project>/src/workflows; tests express business intent and test.step() evidence.\n- Never import another project's code. Reusable-only capability belongs in src/framework.\n- Never hide a product defect by weakening assertions or silently adding test.fixme/skip. Use the project's known-defect governance only after human confirmation.\n- Generated code remains a proposal until proposal validation and human approval/promotion complete.\n- Finish by running typecheck, test:authoring:contract and proposal:validate for the requirement.\n`;

const roots = ['.github/agents', '.claude/agents', '.opencode/prompts', '.codex/agents'];
let updated = 0;
for (const root of roots) {
  if (!fs.existsSync(root)) continue;
  for (const name of fs.readdirSync(root)) {
    const file = path.join(root, name);
    if (!fs.statSync(file).isFile()) continue;
    let text = fs.readFileSync(file, 'utf8');
    if (text.includes(marker)) continue;

    if (file.endsWith('.md')) {
      // Let the coding-agent/client own model selection rather than pinning a vendor/model in source control.
      text = text.replace(/^model:\s*.*\n/gm, '');
      text += overlay;
    } else if (file.endsWith('.toml')) {
      const tomlOverlay = overlay.replace(/^# /gm, '').replace(/\n/g, '\n');
      const close = '\n"""\n\n[mcp_servers';
      if (text.includes(close)) text = text.replace(close, `${tomlOverlay}\n"""\n\n[mcp_servers`);
      else text += `\n# ${marker}\n# See agent-prompts/framework-test-generation.md before use.\n`;
    } else {
      continue;
    }
    fs.writeFileSync(file, text, 'utf8');
    updated += 1;
  }
}
console.log(`[agents] enterprise policy overlay checked; updated=${updated}`);
