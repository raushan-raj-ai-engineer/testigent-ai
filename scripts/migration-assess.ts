import fs from 'node:fs';
import path from 'node:path';
import { WorkspaceContext } from '../src/framework/core/config/workspace.context';
import { RunContext } from '../src/framework/core/config/run.context';
import { ProjectPaths } from '../src/framework/core/config/project.paths';

type FindingKind = 'raw-ui' | 'navigation' | 'raw-api' | 'raw-db' | 'direct-healing' | 'direct-ai';

interface Finding {
  file: string;
  line: number;
  kind: FindingKind;
  evidence: string;
  recommendation: string;
}

interface Assessment {
  schemaVersion: 1;
  generatedAt: string;
  application: string;
  environment: string;
  scannedRoot: string;
  filesScanned: number;
  findings: Finding[];
  summary: Record<FindingKind, number>;
  migrationOrder: string[];
  migrationSlices: Array<{ name: string; findingKinds: FindingKind[]; files: string[]; objective: string }>;
}

const RULES: Array<{ kind: FindingKind; regex: RegExp; recommendation: string }> = [
  {
    kind: 'direct-ai',
    regex: /\b(?:new\s+)?AiGateway\b|from\s+['"][^'"]*framework\/ai\//,
    recommendation: 'Keep AI behind framework-owned authoring/healing services; application tests should consume project workflows/facades.'
  },
  {
    kind: 'direct-healing',
    regex: /\b(?:new\s+)?HealingOrchestrator\b|from\s+['"][^'"]*framework\/healing\//,
    recommendation: 'Move locator plans and recovery orchestration into project page/component objects or approved framework extensions.'
  },
  {
    kind: 'raw-db',
    regex: /from\s+['"](?:pg|mysql2|mssql)['"]|require\(['"](?:pg|mysql2|mssql)['"]\)/,
    recommendation: 'Use the framework DB capability/repository layer so credentials, lifecycle, evidence and project boundaries remain governed.'
  },
  {
    kind: 'raw-api',
    regex: /\brequest\.(?:get|post|put|patch|delete|fetch)\s*\(|\bAPIRequestContext\b/,
    recommendation: 'Move service calls into project-owned API clients/repositories built on BaseApiClient so evidence redaction and diagnostics are consistent.'
  },
  {
    kind: 'navigation',
    regex: /\bpage\.goto\s*\(/,
    recommendation: 'Move route knowledge into the project facade/page/workflow layer instead of hard-coding navigation in tests.'
  },
  {
    kind: 'raw-ui',
    regex: /\bpage\.(?:locator|getByRole|getByText|getByLabel|getByPlaceholder|getByTestId|click|fill|press|check|uncheck|selectOption)\s*\(/,
    recommendation: 'Migrate reusable UI interaction into project page/component/workflow objects; keep tests business-readable.'
  }
];

main();

function main(): void {
  const target = WorkspaceContext.resolve();
  const requested = process.argv.slice(2).find(arg => !arg.startsWith('--'));
  const scanRoot = path.resolve(requested || path.join('projects', target.application, 'tests'));
  if (!fs.existsSync(scanRoot)) throw new Error(`Migration source does not exist: ${scanRoot}`);

  const files = collectTypeScript(scanRoot);
  const findings = files.flatMap(file => scanFile(file));
  const summary = Object.fromEntries(RULES.map(rule => [rule.kind, findings.filter(item => item.kind === rule.kind).length])) as Record<FindingKind, number>;
  const assessment: Assessment = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    application: target.application,
    environment: target.environment,
    scannedRoot: path.relative(process.cwd(), scanRoot) || '.',
    filesScanned: files.length,
    findings,
    summary,
    migrationOrder: [
      'Preserve existing assertions and business coverage first; do not bulk rewrite tests.',
      'Move hard-coded routes/selectors/interactions into project-owned facades, pages, components and workflows.',
      'Move direct service/database access behind project API clients/repositories using framework capabilities.',
      'Replace direct healing/AI usage in application tests with governed framework entry points.',
      'Run architecture:check, typecheck and the affected project suite after each migration slice.'
    ],
    migrationSlices: buildMigrationSlices(findings)
  };

  const run = RunContext.persistCurrent();
  const outputDir = path.join(ProjectPaths.reports(target.application, target.environment, run.runId), 'migration');
  fs.mkdirSync(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, 'migration-assessment.json');
  const markdownPath = path.join(outputDir, 'migration-assessment.md');
  fs.writeFileSync(jsonPath, JSON.stringify(assessment, null, 2));
  fs.writeFileSync(markdownPath, toMarkdown(assessment));

  console.log(JSON.stringify({
    ok: true,
    application: target.application,
    environment: target.environment,
    filesScanned: files.length,
    findings: findings.length,
    summary,
    json: path.relative(process.cwd(), jsonPath),
    markdown: path.relative(process.cwd(), markdownPath)
  }, null, 2));
}

function collectTypeScript(root: string): string[] {
  if (fs.statSync(root).isFile()) return /\.(?:ts|tsx)$/.test(root) ? [root] : [];
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!['node_modules', 'reports', 'test-results', '.git'].includes(entry.name)) walk(full);
      } else if (/\.(?:spec\.)?(?:ts|tsx)$/.test(entry.name)) files.push(full);
    }
  };
  walk(root);
  return files.sort();
}

function scanFile(file: string): Finding[] {
  const relative = path.relative(process.cwd(), file);
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const results: Finding[] = [];
  lines.forEach((line, index) => {
    if (/migration-assess|architecture exception/i.test(line)) return;
    for (const rule of RULES) {
      if (!rule.regex.test(line)) continue;
      results.push({
        file: relative,
        line: index + 1,
        kind: rule.kind,
        evidence: line.trim().slice(0, 220),
        recommendation: rule.recommendation
      });
    }
  });
  return results;
}

function toMarkdown(value: Assessment): string {
  const byKind = Object.entries(value.summary).map(([kind, count]) => `| ${kind} | ${count} |`).join('\n');
  const findings = value.findings.length
    ? value.findings.map(item => `- \`${item.file}:${item.line}\` **${item.kind}** — ${escapeMarkdown(item.evidence)}\n  - ${item.recommendation}`).join('\n')
    : '- No migration hotspots detected by the static assessment rules.';
  return `# TestigentAI Migration Assessment\n\n` +
    `Generated: ${value.generatedAt}\n\n` +
    `Application/environment: **${value.application}/${value.environment}**  \n` +
    `Scanned: \`${value.scannedRoot}\` (${value.filesScanned} TypeScript files)\n\n` +
    `This is an adoption aid, not an automatic rewrite. It inventories likely framework-bypass hotspots so teams can migrate existing Playwright suites incrementally without discarding working assertions.\n\n` +
    `## Summary\n\n| Finding | Count |\n| --- | ---: |\n${byKind}\n\n` +
    `## Recommended migration order\n\n${value.migrationOrder.map((item, index) => `${index + 1}. ${item}`).join('\n')}\n\n` +
    `## Migration slices\n\n${value.migrationSlices.length ? value.migrationSlices.map((slice, index) => `${index + 1}. **${slice.name}** — ${slice.objective}\n   - Files: ${slice.files.map(file => `\`${file}\``).join(', ') || 'none'}`).join('\n') : '- No migration slice is required by the static rules.'}\n\n` +
    `## Findings\n\n${findings}\n`;
}

function buildMigrationSlices(findings: Finding[]): Assessment['migrationSlices'] {
  const definitions: Array<{ name: string; findingKinds: FindingKind[]; objective: string }> = [
    { name: 'UI ownership', findingKinds: ['raw-ui', 'navigation'], objective: 'Move selectors, navigation and mechanics behind project page/workflow boundaries without changing assertions.' },
    { name: 'Service and data ownership', findingKinds: ['raw-api', 'raw-db'], objective: 'Move direct transport/database access behind project API clients and repositories while preserving test intent.' },
    { name: 'Governed recovery and AI', findingKinds: ['direct-healing', 'direct-ai'], objective: 'Replace direct framework internals with approved project/framework entry points and review gates.' }
  ];
  return definitions.map(definition => ({
    ...definition,
    files: [...new Set(findings.filter(item => definition.findingKinds.includes(item.kind)).map(item => item.file))].sort()
  })).filter(slice => slice.files.length > 0);
}

function escapeMarkdown(value: string): string {
  return value.replace(/`/g, '\\`').replace(/\|/g, '\\|');
}
