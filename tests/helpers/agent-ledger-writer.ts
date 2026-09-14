import path from 'node:path';
import { AgentDecisionLedger } from '../../src/framework/agentic/evidence/agent-decision-ledger.js';

const [root, id, indexRaw] = process.argv.slice(2);
if (!root || !id || indexRaw === undefined) throw new Error('Usage: agent-ledger-writer.ts <root> <decision-id> <index>');
const index = Number(indexRaw);
if (!Number.isInteger(index) || index < 0) throw new Error('index must be a non-negative integer');
const ledger = new AgentDecisionLedger(path.resolve(root));
ledger.append({
  id,
  timestamp: new Date(Date.UTC(2026, 8, 13, 12, 0, index)).toISOString(),
  runId: 'parallel-ledger-run',
  application: 'demo',
  environment: 'qa',
  agent: 'planner',
  operation: 'parallel-write',
  state: 'ACCEPTED',
  rationale: `parallel decision ${index}`,
  confidence: 0.9,
  policyPassed: true,
  deterministicValidationPassed: true,
  humanApprovalRequired: false,
  humanApproved: false,
  evidence: [{ kind: 'requirement', ref: `REQ-${index}` }],
  affectedArtifacts: [`scenario-${index}`],
});
