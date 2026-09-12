import fs from 'node:fs';
import path from 'node:path';
import { DataFactory } from '../src/framework/data/data.factory';
import { resolveExecutionPolicy } from '../src/framework/core/execution/execution.policy';

interface AuditFinding { level: 'ERROR' | 'WARN'; code: string; message: string; }

const PROFILES = ['pr', 'smoke', 'regression', 'nightly', 'release', 'custom'] as const;

/**
 * Audits scale-sensitive framework contracts before large parallel/data-driven adoption.
 * Errors are release-blocking; warnings identify architecture debt that may be acceptable temporarily.
 */
function main(): void {
  const findings: AuditFinding[] = [];
  const projectsRoot = path.resolve('projects');
  const projects = fs.existsSync(projectsRoot)
    ? fs.readdirSync(projectsRoot, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name)
    : [];

  for (const project of projects) {
    const projectConfig = path.join(projectsRoot, project, 'project.json');
    if (!fs.existsSync(projectConfig)) findings.push({ level: 'ERROR', code: 'PROJECT_CONFIG', message: `${project} is missing project.json.` });
    auditCaseDatasets(project, findings);
    auditTests(project, findings);
  }

  for (const project of projects) auditExecutionMatrix(project, findings);

  const errors = findings.filter(item => item.level === 'ERROR');
  const warnings = findings.filter(item => item.level === 'WARN');
  for (const item of findings) console.log(`[${item.level}] ${item.code}: ${item.message}`);
  console.log(`Scale audit: ${errors.length} error(s), ${warnings.length} warning(s), ${projects.length} project(s).`);
  if (errors.length) process.exitCode = 1;
}


function auditExecutionMatrix(project: string, findings: AuditFinding[]): void {
  const configDir = path.resolve('projects', project, 'config');
  const environments = fs.existsSync(configDir)
    ? fs.readdirSync(configDir).filter(file => file.endsWith('.json')).map(file => path.basename(file, '.json'))
    : [];
  if (!environments.length) {
    findings.push({ level: 'ERROR', code: 'ENV_CONFIG', message: `${project} has no environment configuration.` });
    return;
  }
  for (const environment of environments) {
    for (const profile of PROFILES) {
      try {
        const policy = resolveExecutionPolicy({ application: project, environment, profile, env: {} });
        if (typeof policy.workers === 'string' && !/^\d+%$/.test(policy.workers)) {
          findings.push({ level: 'ERROR', code: 'WORKERS', message: `${project}/${environment}/${profile} has invalid percentage workers '${policy.workers}'.` });
        }
        if (profile === 'custom' && (policy.allowAi || policy.allowGenerated || policy.allowManual)) {
          findings.push({ level: 'ERROR', code: 'CUSTOM_GOVERNANCE', message: `${project}/${environment}/custom must default-deny AI, generated and manual execution.` });
        }
        if (policy.includeTags.length && !projectHasAnyTag(project, policy.includeTags)) {
          findings.push({
            level: 'ERROR',
            code: 'PROFILE_EMPTY',
            message: `${project}/${environment}/${profile} requires one of [${policy.includeTags.join(', ')}] but no project test declares any of those tags. The profile would select zero tests.`,
          });
        }
      } catch (error) {
        findings.push({ level: 'ERROR', code: 'EXECUTION_POLICY', message: `${project}/${environment}/${profile}: ${error instanceof Error ? error.message : String(error)}` });
      }
    }
  }
}

function projectHasAnyTag(project: string, tags: string[]): boolean {
  const root = path.resolve('projects', project, 'tests');
  if (!fs.existsSync(root)) return false;
  const sources = walk(root)
    .filter(file => /\.spec\.[cm]?[jt]s$/i.test(file))
    .filter(file => !file.replace(/\\/g, '/').includes('/tests/_agent/'))
    .map(file => fs.readFileSync(file, 'utf8'));
  return tags.some(tag => sources.some(source => source.includes(tag)));
}

function auditCaseDatasets(project: string, findings: AuditFinding[]): void {
  const root = path.resolve('projects', project, 'data');
  if (!fs.existsSync(root)) return;
  const data = new DataFactory();
  for (const file of walk(root).filter(file => /\.(json|csv|ya?ml|xlsx?)$/i.test(file))) {
    const normalized = file.replace(/\\/g, '/');
    if (!/\/cases?\//i.test(normalized) && !/case/i.test(path.basename(file))) continue;
    try { data.loadCasesSync(file); }
    catch (error) { findings.push({ level: 'ERROR', code: 'CASE_DATA', message: `${path.relative(process.cwd(), file)}: ${error instanceof Error ? error.message : String(error)}` }); }
  }
}

function auditTests(project: string, findings: AuditFinding[]): void {
  const root = path.resolve('projects', project, 'tests');
  if (!fs.existsSync(root)) return;
  for (const file of walk(root).filter(file => /\.spec\.[cm]?[jt]s$/i.test(file))) {
    const normalized = file.replace(/\\/g, '/');
    // _agent/seed.spec.ts is authoring/bootstrap infrastructure, not a runnable business lane.
    if (normalized.includes('/tests/_agent/seed.spec.')) continue;
    const text = fs.readFileSync(file, 'utf8');
    const hasExecutionLane = /@lane:(ui|api|db|e2e|ai|visual|accessibility|performance)|@(ui|api|db|e2e|ai|visual|accessibility|performance)\b/.test(text);
    const isPureDataContract = /@data\b/.test(text);
    if (!hasExecutionLane && !isPureDataContract) {
      findings.push({ level: 'WARN', code: 'LANE_TAG', message: `${path.relative(process.cwd(), file)} has no explicit execution-lane tag or pure-data classification.` });
    }
    if (/loadCasesSync\s*</.test(text) || /loadCasesSync\s*\(/.test(text)) {
      if (!/annotation\s*:\s*\{\s*type\s*:\s*['"]caseId['"]/.test(text)) {
        findings.push({ level: 'ERROR', code: 'CASE_ID_ANNOTATION', message: `${path.relative(process.cwd(), file)} uses loadCasesSync but does not declare a caseId annotation for independently traceable rows.` });
      }
    }
    if (/test\s*\([\s\S]{0,500}?async\s*\([^)]*\)\s*=>\s*\{[\s\S]{0,1000}?for\s*\(/m.test(text)) {
      findings.push({ level: 'WARN', code: 'RUNTIME_DATA_LOOP', message: `${path.relative(process.cwd(), file)} appears to iterate data inside a test body; prefer one declaration-time Playwright test per data row.` });
    }
  }
}

function walk(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

main();
