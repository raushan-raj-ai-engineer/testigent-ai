import 'dotenv/config';
import { AgentDecisionLedger } from '../src/framework/agentic/evidence/agent-decision-ledger.js';

/** CLI entrypoint for reading the sanitized run-scoped agent decision ledger. */
function main(): void {
  const project = process.argv[2] ?? process.env.APP;
  const runId = process.argv[3] ?? process.env.RUN_ID;
  const environment = process.argv[4] ?? process.env.ENV ?? 'qa';
  if (!project || !runId) throw new Error('Usage: npm run agentic:evidence -- <project> <run-id> [environment]');
  const ledger = AgentDecisionLedger.forRun(process.cwd(), project, environment, runId);
  console.log(JSON.stringify({ summary: ledger.summary(), decisions: ledger.read() }, null, 2));
}
try { main(); } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
