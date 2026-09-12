import fs from 'node:fs';
import path from 'node:path';
import { ProjectPaths } from '../src/framework/core/config/project.paths';

/**
 * Author: Raushan Raj
 * Business Use: Promotes the merged CI dashboard into the canonical reports/<APP>/<ENV>/<RUN_ID>/business location used by publishing and notification.
 * How to use: Run after report:merge:business and before ci:business:validate / ci:mail.
 * Benefit: Every downstream consumer reads the same immutable merged dashboard instead of shard-local or stale report folders.
 */
function main(): void {
  const source = path.resolve(process.env.MERGED_BUSINESS_REPORT_DIR ?? path.join(ProjectPaths.reports(), 'business-merged'));
  const target = path.resolve(process.env.FINAL_BUSINESS_REPORT_DIR ?? ProjectPaths.businessReport());
  requireFile(path.join(source, 'business-report.json'));
  requireFile(path.join(source, 'index.html'));
  requireFile(path.join(source, 'assets', 'dashboard.js'));
  requireFile(path.join(source, 'business-tests.csv'));

  const staging = `${target}.staging-${process.pid}`;
  fs.rmSync(staging, { recursive: true, force: true });
  fs.cpSync(source, staging, { recursive: true });
  fs.rmSync(target, { recursive: true, force: true });
  fs.renameSync(staging, target);

  const facts = JSON.parse(fs.readFileSync(path.join(target, 'business-report.json'), 'utf8')) as { runId?: string; total?: number; executed?: number; executionEligible?: number; executionRate?: number; qualityPassRate?: number; qualityFailed?: number; knownDefects?: number; ciBlockingIssues?: number; passRate?: number };
  fs.writeFileSync(path.join(target, 'ci-publication.json'), JSON.stringify({
    runId: facts.runId,
    selected: facts.total,
    applicable: facts.executionEligible,
    executed: facts.executed,
    executionRate: facts.executionRate,
    qualityPassRate: facts.qualityPassRate,
    qualityFailed: facts.qualityFailed,
    knownDefects: facts.knownDefects,
    ciBlockingIssues: facts.ciBlockingIssues,
    passRate: facts.passRate,
    publishedAt: new Date().toISOString(),
    publicUrl: cleanEnv('REPORT_PUBLIC_URL') ?? null,
    businessEmailEnabled: truthy(process.env.BUSINESS_EMAIL_ENABLED)
  }, null, 2));

  console.log(`Final business dashboard promoted to ${target}`);
}

function requireFile(file: string): void { if (!fs.existsSync(file)) throw new Error(`Required merged dashboard file missing: ${file}`); }
function truthy(value?: string): boolean { return ['1', 'true', 'yes', 'on'].includes((value ?? '').trim().toLowerCase()); }
function cleanEnv(name: string): string | undefined { const value = process.env[name]?.trim(); return !value || value.startsWith('$(') ? undefined : value; }
main();
