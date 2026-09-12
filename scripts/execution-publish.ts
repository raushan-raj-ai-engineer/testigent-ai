/** CLI: publish one selected execution/result back to a configured management tool. Author: Raushan Raj */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { intelligenceFlags } from '../src/framework/intelligence/core/flags.js';
import type { ExecutionPublishRequest, ExecutionStatus } from '../src/framework/intelligence/core/models.js';
import { publisherFor } from '../src/framework/intelligence/publishers/publishers.js';
import { auditPublish } from '../src/framework/intelligence/publishers/audit.js';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  if (!intelligenceFlags.publishEnabled()) {
    console.log('Execution status publishing disabled (EXECUTION_STATUS_PUBLISH_ENABLED=false). Nothing external was updated.');
    return;
  }

  const target = arg('target') ?? process.env.EXECUTION_STATUS_PUBLISH_TARGET;
  const requirementId = arg('requirement');
  const runId = arg('run-id') ?? process.env.RUN_ID ?? `local-${Date.now()}`;
  const resultFile = arg('result');
  if (!target || !requirementId) {
    throw new Error('Usage: EXECUTION_STATUS_PUBLISH_ENABLED=true npm run execution:publish -- --target jira --requirement PAY-142 [--result reports/<APP>/<ENV>/<RUN_ID>/business/business-report.json]');
  }

  let raw: any = {};
  if (resultFile) raw = JSON.parse(await readFile(resolve(resultFile), 'utf8'));
  const metrics = raw.metrics ?? raw.summary ?? raw;
  const failedScenarios = (raw.tests ?? raw.results ?? [])
    .filter((test: any) => String(test.status ?? '').toLowerCase() === 'failed')
    .map((test: any) => String(test.title ?? test.name ?? 'Unknown failed scenario'));

  const total = Number(metrics.total ?? metrics.totalTests ?? 0);
  const passed = Number(metrics.passed ?? 0);
  const failed = Number(metrics.failed ?? 0);
  const skipped = Number(metrics.skipped ?? 0);
  const inferred: ExecutionStatus = failed > 0 ? 'FAILED' : total > 0 && passed > 0 ? 'PASSED' : 'BLOCKED';
  const request: ExecutionPublishRequest = {
    runId,
    requirementId,
    status: (arg('status') as ExecutionStatus | undefined) ?? inferred,
    environment: arg('env') ?? process.env.ENV,
    dashboardUrl: arg('dashboard-url') ?? process.env.REPORT_PUBLIC_URL,
    total,
    passed,
    failed,
    skipped,
    flaky: Number(metrics.flaky ?? 0),
    selfHealed: Number(metrics.selfHealed ?? metrics.healingCount ?? 0),
    aiHealing: Number(metrics.aiHealing ?? metrics.aiHealingCount ?? 0),
    failedScenarios
  };

  const result = await publisherFor(target).publish(request);
  const audit = await auditPublish(process.cwd(), request, result);
  console.log(JSON.stringify({ request, result, audit }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
