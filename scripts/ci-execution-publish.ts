/** CI helper: optionally publish one final merged execution. Author: Raushan Raj */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ProjectPaths } from '../src/framework/core/config/project.paths.js';
import { intelligenceFlags } from '../src/framework/intelligence/core/flags.js';
import type { ExecutionPublishRequest, ExecutionStatus } from '../src/framework/intelligence/core/models.js';
import { publisherFor } from '../src/framework/intelligence/publishers/publishers.js';
import { auditPublish } from '../src/framework/intelligence/publishers/audit.js';

async function main(): Promise<void> {
  if (!intelligenceFlags.publishEnabled()) {
    console.log('Execution publishing disabled; CI will not contact any project-management system.');
    return;
  }

  const target = process.env.EXECUTION_STATUS_PUBLISH_TARGET;
  const requirementId = process.env.EXECUTION_REQUIREMENT_ID;
  if (!target || !requirementId) {
    throw new Error('Publishing enabled but EXECUTION_STATUS_PUBLISH_TARGET or EXECUTION_REQUIREMENT_ID is missing.');
  }

  const file = process.env.BUSINESS_REPORT_JSON ?? path.join(ProjectPaths.businessReport(), 'business-report.json');
  const raw = JSON.parse(await readFile(file, 'utf8'));
  const metrics = raw.metrics ?? raw.summary ?? raw;
  const tests = raw.tests ?? raw.results ?? [];
  const total = Number(metrics.total ?? metrics.totalTests ?? tests.length ?? 0);
  const passed = Number(metrics.passed ?? 0);
  const failed = Number(metrics.failed ?? 0);
  const skipped = Number(metrics.skipped ?? 0);
  const status: ExecutionStatus = failed ? 'FAILED' : passed ? 'PASSED' : 'BLOCKED';

  const request: ExecutionPublishRequest = {
    runId: process.env.RUN_ID ?? process.env.GITHUB_RUN_ID ?? process.env.BUILD_BUILDID ?? `ci-${Date.now()}`,
    requirementId,
    status,
    environment: process.env.ENV,
    dashboardUrl: process.env.REPORT_PUBLIC_URL,
    total,
    passed,
    failed,
    skipped,
    flaky: Number(metrics.flaky ?? 0),
    selfHealed: Number(metrics.selfHealed ?? metrics.healingCount ?? 0),
    aiHealing: Number(metrics.aiHealing ?? metrics.aiHealingCount ?? 0),
    failedScenarios: tests
      .filter((test: any) => String(test.status ?? '').toLowerCase() === 'failed')
      .map((test: any) => String(test.title ?? test.name ?? 'Unknown failed scenario'))
  };

  const result = await publisherFor(target).publish(request);
  const audit = await auditPublish(process.cwd(), request, result);
  console.log(JSON.stringify({ request, result, audit }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
