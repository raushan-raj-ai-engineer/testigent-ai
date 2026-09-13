import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { WorkspaceContext } from '../src/framework/core/config/workspace.context';
import { RunContext } from '../src/framework/core/config/run.context';
import { ProjectPaths } from '../src/framework/core/config/project.paths';
import { analyzeChangeImpact } from '../src/framework/intelligence/change-impact';

/** CLI: explain changed-code impact and recommend tests without silently narrowing CI. */
function main(): void {
  const target = WorkspaceContext.resolve();
  const args = process.argv.slice(2);
  const filesArg = valueOf(args, '--files');
  const base = valueOf(args, '--base') ?? 'HEAD~1';
  const head = valueOf(args, '--head') ?? 'HEAD';
  const changedFiles = filesArg ? filesArg.split(',').map(value => value.trim()).filter(Boolean) : gitDiff(base, head);
  const result = analyzeChangeImpact({ root: process.cwd(), application: target.application, changedFiles });
  const run = RunContext.persistCurrent();
  const outputDir = path.join(ProjectPaths.reports(target.application, target.environment, run.runId), 'change-impact');
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'change-impact.json'), JSON.stringify(result, null, 2));
  fs.writeFileSync(path.join(outputDir, 'change-impact.md'), markdown(result));
  console.log(JSON.stringify({
    ok: true,
    application: result.application,
    selectionMode: result.selectionMode,
    changedFiles: result.changedFiles.length,
    selectedTests: result.selectedTests.length,
    requirements: result.requirements,
    report: path.relative(process.cwd(), path.join(outputDir, 'change-impact.md'))
  }, null, 2));
}

function gitDiff(base: string, head: string): string[] {
  const result = spawnSync('git', ['diff', '--name-only', `${base}...${head}`], { cwd: process.cwd(), encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Unable to resolve changed files from git ${base}...${head}: ${(result.stderr || result.stdout).trim()}`);
  return result.stdout.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
}
function valueOf(args: string[], name: string): string | undefined {
  const exact = args.find(arg => arg.startsWith(`${name}=`));
  if (exact) return exact.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}
function markdown(result: ReturnType<typeof analyzeChangeImpact>): string {
  const rows = result.selectedTests.length
    ? result.selectedTests.map(test => `| \`${test.file}\` | ${test.critical ? 'yes' : 'no'} | ${test.requirements.join(', ') || '—'} | ${test.reasons.join('<br>')} |`).join('\n')
    : '| — | — | — | No project test was selected by static evidence. Review caveats before deciding to skip execution. |';
  return `# TestigentAI Change Impact\n\nGenerated: ${result.generatedAt}\n\nApplication: **${result.application}**  \nSelection mode: **${result.selectionMode}**\n\n## Changed files\n\n${result.changedFiles.map(file => `- \`${file}\``).join('\n') || '- None'}\n\n## Recommended tests\n\n| Test | Critical | Requirements | Why selected |\n| --- | --- | --- | --- |\n${rows}\n\n## Guardrails\n\n${result.caveats.map(item => `- ${item}`).join('\n')}\n`;
}

try { main(); } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
