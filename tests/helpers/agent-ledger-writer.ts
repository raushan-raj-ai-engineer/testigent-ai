import { AgentDecisionLedger } from '../../src/framework/agentic/evidence/agent-decision-ledger.js';

const [root, id, indexRaw] = process.argv.slice(2);

if (!root || !id || indexRaw === undefined) {
  throw new Error('Usage: agent-ledger-writer <root> <decision-id> <index>');
}

const index = Number(indexRaw);
if (!Number.isInteger(index) || index < 0) {
  throw new Error(`Invalid writer index: ${indexRaw}`);
}

const ledger = new AgentDecisionLedger(root);

ledger.append({
  id,
  timestamp: new Date(Date.UTC(2026, 8, 13, 12, 0, index)).toISOString(),
  runId: 'run-concurrent',
  application: 'demo',
  environment: 'qa',
  agent: 'planner',
  operation: 'plan',
  state: 'ACCEPTED',
  rationale: `Concurrent writer ${index}`,
  confidence: 0.9,
  policyPassed: true,
  deterministicValidationPassed: true,
  humanApprovalRequired: false,
  humanApproved: false,
  evidence: [{ kind: 'requirement', ref: `REQ-${index}` }],
  affectedArtifacts: [`S${index}`],
});
