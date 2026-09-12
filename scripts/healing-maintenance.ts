import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { WorkspaceContext } from '../src/framework/core/config/workspace.context';
import { ProjectPaths } from '../src/framework/core/config/project.paths';
import type { HealingDecision, LocatorDescriptor } from '../src/framework/healing/healing.types';

interface AuditRecord {
  outcome?: 'validated' | 'rejected' | 'suggested' | 'unverified';
  timestamp?: string;
  planId?: string;
  businessName?: string;
  pageUrl?: string;
  decision?: HealingDecision;
}

interface Candidate {
  planId: string;
  businessName: string;
  occurrences: number;
  sources: Record<string, number>;
  lastSeen?: string;
  pageUrls: string[];
  proposedDescriptor?: LocatorDescriptor;
}

const target = WorkspaceContext.resolve();
const minimum = positiveInteger(process.env.HEALING_MAINTENANCE_MIN_OCCURRENCES, 3);
const outputDir = path.join(ProjectPaths.latestReports(target.application, target.environment), 'healing');
const auditFile = path.join(outputDir, 'healing-audit.jsonl');
const agentDir = path.resolve('.runtime', 'agent-work');

if (!fs.existsSync(auditFile)) {
  console.log(`No healing audit found for ${target.application}: ${path.relative(process.cwd(), auditFile)}`);
  process.exit(0);
}

const records = fs.readFileSync(auditFile, 'utf8').split('\n').filter(Boolean).flatMap(line => {
  try { return [JSON.parse(line) as AuditRecord]; } catch { return []; }
}).filter(record => record.planId && record.decision && record.decision.source !== 'primary' && (record.outcome ?? 'validated') === 'validated');

const grouped = new Map<string, AuditRecord[]>();
for (const record of records) {
  const planId = record.planId!;
  grouped.set(planId, [...(grouped.get(planId) ?? []), record]);
}

const candidates: Candidate[] = [...grouped.entries()].flatMap(([planId, items]) => {
  if (items.length < minimum) return [];
  const last = items.at(-1)!;
  const sources: Record<string, number> = {};
  for (const item of items) sources[item.decision!.source] = (sources[item.decision!.source] ?? 0) + 1;
  return [{
    planId,
    businessName: last.businessName ?? planId,
    occurrences: items.length,
    sources,
    lastSeen: last.timestamp,
    pageUrls: [...new Set(items.map(item => item.pageUrl).filter((value): value is string => Boolean(value)))].slice(-5),
    proposedDescriptor: last.decision?.descriptor,
  }];
}).sort((a, b) => b.occurrences - a.occurrences);

fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(agentDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'maintenance-candidates.json'), JSON.stringify({
  generatedAt: new Date().toISOString(), application: target.application, environment: target.environment, minimumOccurrences: minimum, candidates,
}, null, 2));

const rows = candidates.length
  ? candidates.map(item => `| ${item.planId} | ${item.businessName} | ${item.occurrences} | ${Object.entries(item.sources).map(([source, count]) => `${source}:${count}`).join(', ')} |`).join('\n')
  : '| — | — | 0 | — |';
fs.writeFileSync(path.join(outputDir, 'maintenance-candidates.md'), `# Healing Maintenance Candidates\n\nOnly semantically validated runtime healing is promotion evidence. Rejected, suggested and unverified locator attempts are retained for audit/reporting but never become source-maintenance candidates. A repeated validated recovery becomes a maintenance candidate after **${minimum}** occurrences.\n\n| Plan | Business element | Occurrences | Recovery sources |\n|---|---|---:|---|\n${rows}\n`, 'utf8');

const promptFile = path.join(agentDir, `healing-${target.application}.md`);
fs.writeFileSync(promptFile, `# TestigentAI Source-Healing Review\n\nProject: ${target.application}\nEnvironment: ${target.environment}\n\nReview **${path.relative(process.cwd(), path.join(outputDir, 'maintenance-candidates.json'))}** and use the Playwright healer/CLI only to verify the live UI.\n\n## Allowed source changes\n- Update LocatorPlan primary/fallback descriptors when live evidence proves the UI changed.\n- Improve locator scoping or synchronization when behavior remains functionally identical.\n- Remove stale cached recovery after the source locator is corrected.\n\n## Forbidden automatic changes\n- Do not weaken business assertions or expected values.\n- Do not add test.skip(), test.fixme(), or test.fail() to make a failure disappear.\n- Do not change API/DB/security expectations to match a defect.\n- Do not write secrets, session state, or captured tokens into source.\n\nProduce a reviewable patch proposal, run architecture/typecheck/narrow tests, and require human approval before promotion.\n`, 'utf8');

console.log(JSON.stringify({
  ok: true,
  application: target.application,
  auditedRecoveries: records.length,
  candidateCount: candidates.length,
  minimumOccurrences: minimum,
  report: path.relative(process.cwd(), path.join(outputDir, 'maintenance-candidates.md')),
  agentPrompt: path.relative(process.cwd(), promptFile),
}, null, 2));

function positiveInteger(raw: string | undefined, fallback: number): number {
  const value = Number(raw ?? fallback);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}
