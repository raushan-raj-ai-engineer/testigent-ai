import 'dotenv/config';
import { analyzeAgenticImpact } from '../src/framework/agentic/planner/impact-planner.js';
import { AgentDecisionLedger } from '../src/framework/agentic/evidence/agent-decision-ledger.js';

/** CLI entrypoint for deterministic project-scoped change-impact planning. */
function main(): void {
  const project = process.argv[2];
  const changedPaths = process.argv.slice(3);
  if (!project || !changedPaths.length) throw new Error('Usage: npm run agentic:impact -- <project> <changed-path...>');
  const root = process.cwd();
  const environment = process.env.ENV?.trim() || 'qa';
  const runId = process.env.RUN_ID?.trim() || `local-agentic-${Date.now()}`;
  const result = analyzeAgenticImpact(root, project, changedPaths);
  const ledger = AgentDecisionLedger.forRun(root, project, environment, runId);
  ledger.append({ runId, application: project, environment, agent: 'planner', operation: 'analyze-impact', state: result.state, rationale: result.rationale, confidence: result.affectedTests[0]?.score ?? null, policyPassed: true, deterministicValidationPassed: true, humanApprovalRequired: result.state !== 'ACCEPTED', humanApproved: false, evidence: result.evidence, affectedArtifacts: result.affectedTests.map(item => item.testPath) });
  console.log(JSON.stringify({ runId, impact: result }, null, 2));
}
try { main(); } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
