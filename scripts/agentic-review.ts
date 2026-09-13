import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import type { GenerationProposalInput } from '../src/framework/agentic/contracts/generation.types.js';
import { AgentDecisionLedger } from '../src/framework/agentic/evidence/agent-decision-ledger.js';
import { orchestrateGenerationProposal } from '../src/framework/agentic/orchestration/agentic-orchestrator.js';

/** CLI entrypoint for proposal-only deterministic review; it never writes generated content into project source. */
function main(): void {
  const inputFile = process.argv[2];
  if (!inputFile) throw new Error('Usage: npm run agentic:review -- <generation-proposal-input.json>');
  const absolute = path.resolve(inputFile);
  if (!fs.existsSync(absolute)) throw new Error(`Proposal input not found: ${inputFile}`);
  const input = JSON.parse(fs.readFileSync(absolute, 'utf8')) as GenerationProposalInput;
  const root = process.cwd();
  const environment = process.env.ENV?.trim() || 'qa';
  const runId = process.env.RUN_ID?.trim() || `local-agentic-${Date.now()}`;
  const ledger = AgentDecisionLedger.forRun(root, input.project, environment, runId);
  const outcome = orchestrateGenerationProposal(root, ledger, { runId, application: input.project, environment }, input);
  console.log(JSON.stringify({ runId, ...outcome }, null, 2));
  if (!outcome.review.deterministicValidationPassed) process.exitCode = 2;
}
try { main(); } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
