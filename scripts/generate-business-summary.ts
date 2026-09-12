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
  const healingLines = facts.healing.records.length ? facts.healing.records.map(record => `- VALIDATED | ${record.businessName}: ${record.decision.source}${record.decision.aiProvider ? ` via ${record.decision.aiProvider}/${record.decision.aiModel ?? 'default-model'}` : ''}, ${(record.decision.confidence * 100).toFixed(0)}% confidence — ${record.verification?.description ?? record.decision.reason}`).join('\n') : '- No validated self-healing was used in this execution.';
  const rejectedHealingLines = (facts.healing.attempts ?? []).filter(record => record.outcome === 'rejected').map(record => `- REJECTED | ${record.businessName}: ${record.decision.source} — ${record.verification?.description ?? record.decision.reason}`).join('\n') || '- No rejected healing attempts.';
  const flakyLines = facts.flakiness.tests.length ? facts.flakiness.tests.map(test => `- ${test.title} (${test.project}) — ${test.attempts.length} attempt(s)`).join('\n') : '- No retry-recovered/flaky tests detected.';
  const gateReasons = facts.qualityGate.reasons.length ? facts.qualityGate.reasons.map(reason => `- ${reason}`).join('\n') : '- No configured gate condition requires attention.';
  const knownDefectLines = facts.results.filter(result => result.outcome === 'KNOWN_DEFECT').map(result => `- ${result.knownDefect?.id ?? 'KNOWN'} | ${result.knownDefect?.title ?? result.title} | ${result.knownDefect?.scope ?? result.title}`).join('\n') || '- No registered known defects in this run.';
  const blockerLines = facts.results.filter(result => result.ciBlocking).map(result => `- ${result.outcome ?? result.status.toUpperCase()} | ${result.title}`).join('\n') || '- No CI-blocking business scenario.';

  const markdown = `# Executive Automation Summary

## Release decision
- Quality gate: ${facts.qualityGate.status}
- Quality pass rate: ${facts.qualityPassRate}%
- Pass threshold: ${facts.qualityGate.passThreshold}%
- Quality failed: ${facts.qualityFailed}
- Known defects: ${facts.knownDefects}
- CI-blocking issues: ${facts.ciBlockingIssues}
${gateReasons}

## Business outcome summary
- Clean passed: ${facts.outcomes.cleanPassed}
- Passed with healing: ${facts.outcomes.passedWithHealing}
- Passed after retry: ${facts.outcomes.passedAfterRetry}
- Known defect: ${facts.outcomes.knownDefects}
- Unexpected failed: ${facts.outcomes.unexpectedFailed}
- Unexpected pass: ${facts.outcomes.unexpectedPass}
- Skipped: ${facts.outcomes.skipped}
- Selected scenarios: ${facts.total}
- Applicable scenarios: ${facts.executionEligible}
- Executed scenarios: ${facts.executed}
- Not applicable: ${facts.notApplicable}
- Blocked before execution: ${facts.blockedSkipped}
- Execution coverage: ${facts.executionRate}%

## Action required
${blockerLines}

## Known defects / accepted quality debt
${knownDefectLines}

## Deterministic release facts
- Run: ${facts.runId}
- Environment: ${facts.environment}
- Application: ${facts.application}
- Generated: ${facts.generatedAt}
- Selected business scenarios: ${facts.total}
- Applicable business scenarios: ${facts.executionEligible}
- Executed business scenarios: ${facts.executed}
- Not-applicable scenarios: ${facts.notApplicable}
- Blocked skipped scenarios: ${facts.blockedSkipped}
- UI coverage: ${facts.layerCounts.UI} test(s)
- API coverage: ${facts.layerCounts.API} test(s)
- Database coverage: ${facts.layerCounts.DATABASE} test(s)
- Flaky tests: ${facts.flakiness.flakyTests}
- Retry attempts: ${facts.flakiness.totalRetryAttempts}
- Validated self-healing events: ${facts.healing.count} (fallback ${facts.healing.fallback}, cache ${facts.healing.cache}, AI ${facts.healing.ai})
- Rejected healing attempts: ${facts.healing.rejected ?? 0}
- Unverified healing actions: ${facts.healing.unverified ?? 0}
- AI runtime calls: ${aiUsage?.calls ?? 0} (${aiUsage?.successfulCalls ?? 0} successful, ${aiUsage?.errorCalls ?? 0} error, ${aiUsage?.budgetBlockedCalls ?? 0} budget-blocked)
- AI average latency: ${aiUsage?.averageLatencyMs ?? 0} ms

> Known defects count as quality failures but are non-blocking only when explicitly registered. These metrics are deterministic framework facts. AI does not calculate or override them.

## Business impact
${impactLines}

## New failure clusters
${clusterLines}

## Flaky / retry-recovered tests
${flakyLines}

## Self-healing audit
${healingLines}

## AI provider/model runtime audit
${providerLines}

## AI business narrative
${aiNarrative ?? 'AI narrative is disabled or unavailable. The deterministic sections above remain the source of truth.'}
`;
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
    totals: { selected: facts.total, applicable: facts.executionEligible, executed: facts.executed, notApplicable: facts.notApplicable, blockedSkipped: facts.blockedSkipped, executionRate: facts.executionRate, qualityPassRate: facts.qualityPassRate, qualityFailed: facts.qualityFailed, knownDefects: facts.knownDefects, unexpectedFailed: facts.unexpectedFailed, unexpectedPass: facts.unexpectedPass, skipped: facts.skipped, ciBlockingIssues: facts.ciBlockingIssues },
    layers: facts.layerCounts,
    testTypes: facts.testTypeCounts,
    flakiness: { flakyTests: facts.flakiness.flakyTests, retryRecovered: facts.flakiness.retryRecovered, totalRetryAttempts: facts.flakiness.totalRetryAttempts },
    healing: { count: facts.healing.count, fallback: facts.healing.fallback, cache: facts.healing.cache, ai: facts.healing.ai, rejected: facts.healing.rejected ?? 0, unverified: facts.healing.unverified ?? 0 },
    failureCategoryCounts: facts.failureCategoryCounts,
    businessImpacts: facts.businessImpacts.map(impact => ({ priority: impact.priority, area: impact.area, affectedTests: impact.affectedTests, approvedImpact: impact.impact })),
    failureClusters: facts.failureClusters.map(cluster => ({ category: cluster.category, affectedTests: cluster.affectedTests, observedEvidence: cluster.evidence }))
  };
}
main().catch(error => { console.error(error); process.exitCode = 1; });
