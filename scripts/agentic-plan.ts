import 'dotenv/config';
import { loadRequirement } from '../src/framework/intelligence/adapters/source.factory.js';
import { analyzeRequirement } from '../src/framework/intelligence/knowledge/analyzer.js';
import { buildAgenticTestPlan } from '../src/framework/agentic/planner/test-planner.js';
import { AgentDecisionLedger } from '../src/framework/agentic/evidence/agent-decision-ledger.js';

/** CLI entrypoint for deterministic requirement-to-agentic-plan generation with run-scoped provenance. */
async function main(): Promise<void> {
  const source = process.argv[2];
  if (!source) throw new Error('Usage: npm run agentic:plan -- <requirement-source>');
  const root = process.cwd();
  const requirement = await loadRequirement(source);
  const analysis = await analyzeRequirement(root, requirement);
  const plan = buildAgenticTestPlan(analysis);
  const application = plan.project ?? process.env.APP?.trim() ?? 'unresolved';
  const environment = process.env.ENV?.trim() || 'qa';
  const runId = process.env.RUN_ID?.trim() || `local-agentic-${Date.now()}`;
  const ledger = AgentDecisionLedger.forRun(root, application, environment, runId);
  ledger.append({ runId, application, environment, agent: 'planner', operation: 'plan-requirement', state: plan.state, rationale: plan.rationale, confidence: plan.confidence, policyPassed: plan.conflicts.length === 0, deterministicValidationPassed: plan.state !== 'REJECTED', humanApprovalRequired: plan.state !== 'ACCEPTED', humanApproved: false, evidence: plan.evidence, affectedArtifacts: plan.scenarios.map(item => item.id) });
  console.log(JSON.stringify({ runId, plan }, null, 2));
  if (plan.state === 'INSUFFICIENT_EVIDENCE' || plan.state === 'REJECTED') process.exitCode = 2;
}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
