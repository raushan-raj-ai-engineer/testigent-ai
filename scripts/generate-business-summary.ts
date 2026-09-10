import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { createAiGateway } from '../src/framework/ai/ai-provider.factory';
import type { ExecutionFacts } from '../src/framework/analytics/report.types';
import { ProjectPaths } from '../src/framework/core/config/project.paths';

/**
 * Author: Raushan Raj
 * Business Use: Creates an executive summary whose metrics are deterministic and whose optional AI text is evidence-grounded.
 * How to use: Run npm run report:business after execution; AI enrichment is optional.
 * Benefit: Business can trust quality gate, layer coverage and counts even when an LLM is unavailable or wrong.
 */
async function main(): Promise<void> {
  const reportDir = ProjectPaths.businessReport();
  const input = path.join(reportDir, 'business-report.json');
  if (!fs.existsSync(input)) throw new Error('Business report JSON not found. Run tests first.');
  const facts = JSON.parse(fs.readFileSync(input, 'utf8')) as ExecutionFacts;
  const gateway = createAiGateway();
  const aiNarrative = await gateway?.summarizeFailures(compactFactsForAi(facts));
  const clusterLines = facts.failureClusters.length ? facts.failureClusters.map(cluster => `- ${cluster.affectedTests} test(s) | ${cluster.category} | ${cluster.evidence}`).join('\n') : '- No final failure clusters.';
  const impactLines = facts.businessImpacts.length ? facts.businessImpacts.map(impact => `- ${impact.priority} | ${impact.area} | ${impact.affectedTests} test(s) — ${impact.impact}`).join('\n') : '- No configured business-impact rule matched a final failed scenario.';
  const aiUsage = facts.aiUsage;
  const providerLines = aiUsage?.providers?.length ? aiUsage.providers.map(item => `- ${item.provider}: ${item.calls} call(s)${item.models.length ? ` · model(s): ${item.models.join(', ')}` : ''}`).join('\n') : '- No AI provider was invoked in this execution.';
  const healingLines = facts.healing.records.length ? facts.healing.records.map(record => `- ${record.businessName}: ${record.decision.source}${record.decision.aiProvider ? ` via ${record.decision.aiProvider}/${record.decision.aiModel ?? 'default-model'}` : ''}, ${(record.decision.confidence * 100).toFixed(0)}% confidence — ${record.decision.reason}`).join('\n') : '- No self-healing was used in this execution.';
  const flakyLines = facts.flakiness.tests.length ? facts.flakiness.tests.map(test => `- ${test.title} (${test.project}) — ${test.attempts.length} attempt(s)`).join('\n') : '- No retry-recovered/flaky tests detected.';
  const gateReasons = facts.qualityGate.reasons.length ? facts.qualityGate.reasons.map(reason => `- ${reason}`).join('\n') : '- No configured gate condition requires attention.';

  const markdown = `# Executive Automation Summary\n\n## Release decision\n- Quality gate: ${facts.qualityGate.status}\n- Pass threshold: ${facts.qualityGate.passThreshold}%\n${gateReasons}\n\n## Deterministic release facts\n- Run: ${facts.runId}\n- Environment: ${facts.environment}\n- Application: ${facts.application}\n- Generated: ${facts.generatedAt}\n- Total: ${facts.total}\n- Passed: ${facts.passed}\n- Failed: ${facts.failed}\n- Skipped: ${facts.skipped}\n- Pass rate: ${facts.passRate}%\n- UI coverage: ${facts.layerCounts.UI} test(s)\n- API coverage: ${facts.layerCounts.API} test(s)\n- Database coverage: ${facts.layerCounts.DATABASE} test(s)\n- Flaky tests: ${facts.flakiness.flakyTests}\n- Retry attempts: ${facts.flakiness.totalRetryAttempts}\n- Self-healing events: ${facts.healing.count} (fallback ${facts.healing.fallback}, cache ${facts.healing.cache}, AI ${facts.healing.ai})\n- AI runtime calls: ${aiUsage?.calls ?? 0} (${aiUsage?.successfulCalls ?? 0} successful, ${aiUsage?.errorCalls ?? 0} error, ${aiUsage?.budgetBlockedCalls ?? 0} budget-blocked)\n- AI average latency: ${aiUsage?.averageLatencyMs ?? 0} ms\n\n> These metrics are produced by deterministic framework code. AI does not calculate or override them.\n\n## Business impact\n${impactLines}\n\n## Failure clusters\n${clusterLines}\n\n## Flaky / retry-recovered tests\n${flakyLines}\n\n## Self-healing audit\n${healingLines}\n\n## AI provider/model runtime audit\n${providerLines}\n\n## AI business narrative\n${aiNarrative ?? 'AI narrative is disabled or unavailable. The deterministic sections above remain the source of truth.'}\n`;
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(path.join(reportDir, 'EXECUTIVE_SUMMARY.md'), markdown);
  fs.writeFileSync(path.join(reportDir, 'ai-summary.json'), JSON.stringify({ runId: facts.runId, generatedAt: new Date().toISOString(), aiEnabled: Boolean(aiNarrative), narrative: aiNarrative ?? null, usage: gateway?.getUsage() ?? null }, null, 2));
  console.log(`Created ${path.join(reportDir, 'EXECUTIVE_SUMMARY.md')}`);
  console.log(`Created ${path.join(reportDir, 'ai-summary.json')}`);
}

function compactFactsForAi(facts: ExecutionFacts): unknown {
  return {
    runId: facts.runId,
    environment: facts.environment,
    application: facts.application,
    qualityGate: facts.qualityGate,
    totals: { total: facts.total, passed: facts.passed, failed: facts.failed, skipped: facts.skipped, passRate: facts.passRate },
    layers: facts.layerCounts,
    testTypes: facts.testTypeCounts,
    flakiness: { flakyTests: facts.flakiness.flakyTests, retryRecovered: facts.flakiness.retryRecovered, totalRetryAttempts: facts.flakiness.totalRetryAttempts },
    healing: { count: facts.healing.count, fallback: facts.healing.fallback, cache: facts.healing.cache, ai: facts.healing.ai },
    failureCategoryCounts: facts.failureCategoryCounts,
    businessImpacts: facts.businessImpacts.map(impact => ({ priority: impact.priority, area: impact.area, affectedTests: impact.affectedTests, approvedImpact: impact.impact })),
    failureClusters: facts.failureClusters.map(cluster => ({ category: cluster.category, affectedTests: cluster.affectedTests, observedEvidence: cluster.evidence }))
  };
}
main().catch(error => { console.error(error); process.exitCode = 1; });
