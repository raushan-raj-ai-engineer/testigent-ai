import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { WorkspaceContext } from '../src/framework/core/config/workspace.context';
import { RunContext } from '../src/framework/core/config/run.context';
import { ProjectPaths } from '../src/framework/core/config/project.paths';
import { loadOpenApiDocument } from '../src/framework/api-contract/openapi-loader';
import { validateResponseContract } from '../src/framework/api-contract/response-contract-validator';
import { detectBreakingChanges } from '../src/framework/api-contract/breaking-change-detector';
import type { OpenApiDocument, ResponseContractResult } from '../src/framework/api-contract/openapi.types';
import { renderApiContractIntelligenceHtml, type ApiContractIntelligenceSummary } from '../src/framework/reporting/api-contract-intelligence.renderer';

const command = (process.argv[2] ?? 'summary').toLowerCase();
const args = process.argv.slice(3);
const target = WorkspaceContext.resolve();
const run = RunContext.persistCurrent();
const outputDir = path.join(ProjectPaths.reports(target.application, target.environment, run.runId), 'api-contract');
fs.mkdirSync(outputDir, { recursive: true });

if (command === 'summary') {
  const spec = path.resolve(required('--spec'));
  const document = loadOpenApiDocument(spec);
  writeSummary({ status: 'PASS', specification: relative(spec), operations: countOperations(document), breakingChanges: [], responseValidations: [], generatedAt: new Date().toISOString() });
} else if (command === 'validate-response') {
  const spec = path.resolve(required('--spec'));
  const bodyFile = path.resolve(required('--body'));
  const document = loadOpenApiDocument(spec);
  const body = JSON.parse(fs.readFileSync(bodyFile, 'utf8')) as unknown;
  const result = validateResponseContract({ document, method: required('--method'), path: required('--path'), status: Number(required('--status')), body, contentType: optional('--content-type') });
  writeSummary({ status: result.ok ? 'PASS' : 'VALIDATION_FAILURES', specification: relative(spec), operations: countOperations(document), breakingChanges: [], responseValidations: [result], generatedAt: new Date().toISOString() });
  if (!result.ok) process.exitCode = 1;
} else if (command === 'diff' || command === 'breaking') {
  const baselineFile = path.resolve(required('--baseline'));
  const currentFile = path.resolve(required('--current'));
  const baseline = loadOpenApiDocument(baselineFile);
  const current = loadOpenApiDocument(currentFile);
  const changes = detectBreakingChanges(baseline, current);
  writeSummary({ status: changes.length ? 'BREAKING_CHANGES' : 'PASS', specification: `${relative(baselineFile)} → ${relative(currentFile)}`, operations: countOperations(current), breakingChanges: changes, responseValidations: [], generatedAt: new Date().toISOString() });
  if (command === 'breaking' && changes.length) process.exitCode = 1;
} else {
  throw new Error('Usage: api-contract.ts summary|validate-response|diff|breaking');
}

function writeSummary(summary: ApiContractIntelligenceSummary): void {
  fs.writeFileSync(path.join(outputDir, 'api-contract-summary.json'), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(outputDir, 'api-contract-intelligence.html'), renderApiContractIntelligenceHtml(summary));
  fs.writeFileSync(path.join(outputDir, 'api-contract-summary.md'), markdown(summary));
  console.log(JSON.stringify({ ok: summary.status === 'PASS', status: summary.status, operations: summary.operations ?? 0, breakingChanges: summary.breakingChanges?.length ?? 0, validationFailures: (summary.responseValidations ?? []).filter(item => !item.ok).length, report: relative(path.join(outputDir, 'api-contract-intelligence.html')) }, null, 2));
}
function markdown(summary: ApiContractIntelligenceSummary): string {
  const changes = summary.breakingChanges?.length ? summary.breakingChanges.map(item => `- **${item.kind}** \`${item.location}\` — ${item.message}`).join('\n') : '- None recorded.';
  const validations = summary.responseValidations?.length ? summary.responseValidations.map(formatValidation).join('\n') : '- None recorded.';
  return `# TestigentAI API Contract Intelligence\n\nStatus: **${summary.status}**  \nSpecification: ${summary.specification ?? '—'}  \nOperations: ${summary.operations ?? 0}\n\n## Breaking changes\n\n${changes}\n\n## Response validation\n\n${validations}\n\n## Truth boundary\n\nThe built-in validator intentionally supports a deterministic OpenAPI 3 subset. Unsupported external references fail closed instead of being silently accepted.\n`;
}
function formatValidation(item: ResponseContractResult): string { return `- ${item.ok ? 'PASS' : 'FAIL'} **${item.method} ${item.path} → ${item.status}**${item.violations.length ? ` — ${item.violations.map(value => `${value.path}: ${value.message}`).join('; ')}` : ''}`; }
function countOperations(document: OpenApiDocument): number { const methods = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']); return Object.values(document.paths).reduce((sum, item) => sum + Object.keys(item).filter(key => methods.has(key.toLowerCase())).length, 0); }
function optional(name: string): string | undefined { const exact = args.find((arg: string) => arg.startsWith(`${name}=`)); if (exact) return exact.slice(name.length + 1); const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; }
function required(name: string): string { const value = optional(name); if (!value) throw new Error(`Missing ${name}.`); return value; }
function relative(file: string): string { return path.relative(process.cwd(), file).replace(/\\/g, '/'); }
