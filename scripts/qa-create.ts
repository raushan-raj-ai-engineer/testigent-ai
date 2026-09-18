/**
 * Unified authoring workflow: one user command for application exploration, requirement intake,
 * complex-UI learning, proposal generation, validation and optional human-approved promotion.
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { RuntimeConfig } from '../src/framework/core/config/runtime.config.js';
import { safeExplore, guidedLearn } from '../src/framework/intelligence/exploration/app.explorer.js';
import { ApplicationKnowledgeStore, type KnowledgeRecord } from '../src/framework/intelligence/knowledge/store.js';
import { loadRequirement } from '../src/framework/intelligence/adapters/source.factory.js';
import { analyzeRequirement } from '../src/framework/intelligence/knowledge/analyzer.js';
import { generateFrameworkProposal } from '../src/framework/intelligence/generation/framework.generator.js';
import {
  approveExplorationProposal,
  generateExplorationProposal,
  promoteExplorationProposal,
  validateExplorationProposal,
} from '../src/framework/intelligence/generation/exploration.proposal.js';
import {
  approveProposal,
  promoteProposal,
  validateProposal,
} from '../src/framework/intelligence/review/proposal.review.js';

interface ParsedArgs {
  source?: string;
  flags: Record<string, string>;
}

type ProposalKind = 'exploration' | 'framework';

function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]!;
    if (!current.startsWith('--')) { positional.push(current); continue; }
    const body = current.slice(2);
    const eq = body.indexOf('=');
    if (eq >= 0) { flags[body.slice(0, eq)] = body.slice(eq + 1); continue; }
    const next = argv[index + 1];
    if (next && !next.startsWith('--') && ['source', 'learn', 'journey', 'reviewer', 'note'].includes(body)) {
      flags[body] = next;
      index += 1;
    } else {
      flags[body] = 'true';
    }
  }
  return { source: flags.source ?? positional[0], flags };
}

function enabled(flags: Record<string, string>, ...names: string[]): boolean {
  return names.some(name => ['true', '1', 'yes', 'on'].includes((flags[name] ?? '').toLowerCase()));
}

function resolveSource(application: string, value: string): string {
  if (/^(?:JIRA:|AZURE:|ADO:|GITHUB:|https?:\/\/)/i.test(value)) return value;
  const direct = path.resolve(value);
  if (fs.existsSync(direct)) return direct;
  const projectRelative = path.resolve('projects', application, 'requirements', value);
  if (fs.existsSync(projectRelative)) return projectRelative;
  const markdown = path.resolve('projects', application, 'requirements', `${value}.md`);
  if (fs.existsSync(markdown)) return markdown;
  return value;
}

function statusOf(record: KnowledgeRecord): string {
  return record.status ?? (record.reviewRequired === false ? 'APPROVED' : 'REVIEW_REQUIRED');
}

function hasGuidedEvents(record: KnowledgeRecord | undefined): boolean {
  if (!record || record.kind !== 'journey') return false;
  const data = record.data && typeof record.data === 'object' ? record.data as Record<string, unknown> : {};
  return Array.isArray(data.events) && data.events.length > 0;
}

async function ask(question: string): Promise<boolean> {
  if (!process.stdin.isTTY) return false;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question(`${question} [y/N] `)).trim().toLowerCase();
    return answer === 'y' || answer === 'yes';
  } finally {
    rl.close();
  }
}

async function pause(message: string): Promise<void> {
  if (!process.stdin.isTTY) throw new Error(`${message} Interactive review requires a TTY.`);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try { await rl.question(`${message}\nPress ENTER when review/editing is complete.\n`); }
  finally { rl.close(); }
}

async function captureKnowledge(
  root: string,
  application: string,
  baseUrl: string,
  flags: Record<string, string>,
  reviewer: string,
): Promise<KnowledgeRecord[]> {
  const store = new ApplicationKnowledgeStore(root);
  const before = new Map((await store.list()).map(record => [record.id, `${record.revision ?? 0}:${record.fingerprint ?? ''}:${statusOf(record)}`]));

  const learnName = flags.learn && flags.learn !== 'true' ? flags.learn.trim() : undefined;
  const manual = Boolean(learnName) || enabled(flags, 'manual-explore', 'manual');
  const automatic = enabled(flags, 'auto-explore', 'auto');

  if (manual && automatic) throw new Error('Choose one exploration style: --auto-explore OR --learn="Journey name".');
  if (manual) {
    await guidedLearn(root, baseUrl, learnName || 'Guided business journey');
  } else if (automatic) {
    await safeExplore(root, baseUrl);
  } else {
    return [];
  }

  const after = (await store.list()).filter(record => record.application === application);
  const changed = after.filter(record => before.get(record.id) !== `${record.revision ?? 0}:${record.fingerprint ?? ''}:${statusOf(record)}` && statusOf(record) === 'REVIEW_REQUIRED');
  if (!changed.length) return [];

  console.log('\nCaptured application knowledge requiring review:');
  for (const record of changed) console.log(`  - ${record.id} [${record.kind}] ${record.title}`);

  const explicitApproval = enabled(flags, 'approve-knowledge');
  const approved = explicitApproval || await ask('Approve the captured knowledge above for generation?');
  if (!approved) {
    console.log('Captured knowledge remains REVIEW_REQUIRED. Generation can continue only with previously approved evidence.');
    return changed;
  }

  for (const record of changed) await store.review(record.id, 'APPROVED', reviewer, 'Approved in unified qa create workflow.');
  console.log(`Approved ${changed.length} captured knowledge record(s).`);
  return changed.map(record => ({ ...record, status: 'APPROVED', reviewRequired: false, reviewedBy: reviewer }));
}

async function findEventJourney(
  store: ApplicationKnowledgeStore,
  application: string,
  requirementTitle: string,
  flags: Record<string, string>,
  captured: KnowledgeRecord[],
): Promise<KnowledgeRecord | undefined> {
  const explicit = flags.journey?.trim();
  if (explicit) {
    const direct = await store.get(explicit);
    if (direct && direct.application === application && statusOf(direct) === 'APPROVED' && hasGuidedEvents(direct)) return direct;
    const matches = await store.search(explicit, { application, status: 'APPROVED', kinds: ['journey'], limit: 20 });
    return matches.find(item => hasGuidedEvents(item));
  }

  const fresh = captured.find(record => record.kind === 'journey' && statusOf(record) === 'APPROVED' && hasGuidedEvents(record));
  if (fresh) return fresh;

  const matches = await store.search(requirementTitle, { application, status: 'APPROVED', kinds: ['journey'], limit: 20 });

  return matches
    .filter(item => hasGuidedEvents(item))
    .sort((left, right) => {
      const leftTime = Date.parse(left.reviewedAt ?? left.learnedAt);
      const rightTime = Date.parse(right.reviewedAt ?? right.learnedAt);
      return rightTime - leftTime;
    })[0];
}

async function validateAndMaybeFinalize(
  root: string,
  requirementId: string,
  kind: ProposalKind,
  flags: Record<string, string>,
  reviewer: string,
): Promise<void> {
  const reviewAndPromote = enabled(flags, 'review-and-promote', 'finish');
  let clean = false;

  const validate = async (): Promise<boolean> => {
    if (kind === 'exploration') {
      const result = await validateExplorationProposal(root, requirementId);
      console.log(JSON.stringify({ proposal: requirementId, type: kind, clean: result.clean, findings: result.findings }, null, 2));
      return result.clean;
    }
    try {
      const result = await validateProposal(root, requirementId);
      console.log(JSON.stringify({ proposal: requirementId, type: kind, clean: true, files: result.files.map(file => file.path) }, null, 2));
      return true;
    } catch (error) {
      console.log(JSON.stringify({ proposal: requirementId, type: kind, clean: false, reviewRequired: error instanceof Error ? error.message : String(error) }, null, 2));
      return false;
    }
  };

  clean = await validate();
  if (reviewAndPromote && !clean) {
    await pause('Review/edit the generated proposal files shown above. Replace placeholders and keep framework architecture intact.');
    clean = await validate();
  }

  const approveRequested = enabled(flags, 'approve', 'review-and-promote', 'finish');
  if (!approveRequested) {
    console.log(`Proposal '${requirementId}' is staged for human review. No automatic approval or promotion was performed.`);
    return;
  }
  if (!clean) throw new Error(`Proposal '${requirementId}' is still not review-clean; approval is blocked.`);
  if (!reviewer.trim()) throw new Error('A reviewer is required for approval. Pass --reviewer="Name".');

  const confirmed = enabled(flags, 'approve') && !reviewAndPromote
    ? true
    : await ask(`Approve proposal '${requirementId}' as reviewer '${reviewer}'?`);
  if (!confirmed) {
    console.log('Proposal remains REVIEW_REQUIRED.');
    return;
  }

  if (kind === 'exploration') await approveExplorationProposal(root, requirementId, reviewer);
  else await approveProposal(root, requirementId, reviewer, flags.note);
  console.log(`Proposal '${requirementId}' approved by ${reviewer}.`);

  const promoteRequested = enabled(flags, 'promote', 'review-and-promote', 'finish');
  if (!promoteRequested) return;
  const promoteConfirmed = reviewAndPromote ? await ask(`Promote approved proposal '${requirementId}' into active project automation?`) : true;
  if (!promoteConfirmed) return;

  if (kind === 'exploration') await promoteExplorationProposal(root, requirementId);
  else await promoteProposal(root, requirementId);
  console.log(`Proposal '${requirementId}' promoted successfully.`);
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  const root = process.cwd();
  const runtime = RuntimeConfig.resolve();
  const application = runtime.applicationName;
  const reviewer = parsed.flags.reviewer?.trim() || process.env.PROPOSAL_REVIEWER?.trim() || process.env.USER?.trim() || 'human-reviewer';

  console.log(`Unified authoring workflow: ${application}/${runtime.environment}`);
  console.log('Complex UI handling is automatic; no separate complex mode is required.');

  // Validate and load the requirement before opening a browser. This prevents users from
  // completing a manual/automatic exploration only to discover that the supplied source
  // path or remote ticket reference is invalid afterwards.
  let requirement: Awaited<ReturnType<typeof loadRequirement>> | undefined;
  if (parsed.source) {
    const source = resolveSource(application, parsed.source);
    requirement = await loadRequirement(source);
    console.log(`Requirement source validated: ${requirement.sourceType}:${requirement.sourceId} - ${requirement.title}`);
  }

  const captured = await captureKnowledge(root, application, runtime.application.uiBaseUrl, parsed.flags, reviewer);
  if (!requirement) {
    console.log(JSON.stringify(await new ApplicationKnowledgeStore(root).summary(application), null, 2));
    console.log('Exploration/learning complete. Add a Markdown/Jira source to the same create command when you want automation generation.');
    return;
  }
  const store = new ApplicationKnowledgeStore(root);
  const journey = await findEventJourney(store, application, requirement.title, parsed.flags, captured);

  let kind: ProposalKind;
  if (journey) {
    console.log(`Using approved guided journey '${journey.id}' for high-fidelity generation.`);
    const manifest = await generateExplorationProposal(root, requirement, application, journey.id);
    console.log(JSON.stringify({ requirementId: manifest.requirementId, status: manifest.status, journeyId: manifest.journeyId, files: manifest.files.map(file => file.staged) }, null, 2));
    kind = 'exploration';
  } else {
    console.log('No approved event journey matched. Falling back to requirement + approved application knowledge scaffolding.');
    const analysis = await analyzeRequirement(root, requirement);
    if (analysis.readiness === 'BLOCKED') throw new Error(`Generation blocked: ${[...analysis.missingInformation, ...analysis.conflicts].join('; ')}`);
    const output = await generateFrameworkProposal(root, analysis);
    console.log(JSON.stringify(output, null, 2));
    kind = 'framework';
  }

  await validateAndMaybeFinalize(root, requirement.sourceId, kind, parsed.flags, reviewer);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
