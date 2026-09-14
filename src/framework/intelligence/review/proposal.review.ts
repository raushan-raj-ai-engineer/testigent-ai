/**
 * Generated proposal review, approval and promotion workflow.
 * Author: Raushan Raj
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  access,
  appendFile,
  copyFile,
  mkdir,
  readFile,
  readdir,
  unlink,
  writeFile
} from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import type { GenerationManifest } from '../core/models.js';
import { resolveWorkspacePath } from '../../agentic/policy/path-policy.js';

export type ProposalReviewStatus = 'REVIEW_REQUIRED' | 'APPROVED' | 'REJECTED' | 'PROMOTED';

export interface ProposalReviewEvent {
  at: string;
  action: 'INITIALIZED' | 'GENERATION_CHANGED' | 'APPROVED' | 'REJECTED' | 'REOPENED' | 'PROMOTED';
  reviewer?: string;
  note?: string;
}

export interface ProposalReviewState {
  version: 1;
  requirementId: string;
  status: ProposalReviewStatus;
  targetApplication?: string;
  initializedAt: string;
  updatedAt: string;
  generationCreatedAt?: string;
  reviewer?: string;
  decisionNote?: string;
  approvedAt?: string;
  rejectedAt?: string;
  promotedAt?: string;
  approvedFileHashes?: Record<string, string>;
  events: ProposalReviewEvent[];
}

export interface ProposalFileInspection {
  kind: string;
  path: string;
  exists: boolean;
  ownedByRequirement: boolean;
  promoted: boolean;
  sha256?: string;
  snapshotSha256?: string;
  changedFromGeneratedSnapshot?: boolean;
  blockingMarkers: string[];
}

export interface ProposalInspection {
  requirementId: string;
  status: ProposalReviewStatus;
  targetApplication?: string;
  approvable: boolean;
  promotable: boolean;
  files: ProposalFileInspection[];
  issues: string[];
  reviewer?: string;
  decisionNote?: string;
}

export interface PromotionManifest {
  version: 1;
  requirementId: string;
  reviewer: string;
  promotedAt: string;
  backupDirectory: string;
  files: Array<{ kind: string; from: string; to: string; sha256: string }>;
}

interface ProposalEntry { kind: string; path: string; }

const GENERATED_HEADER_MARKER = 'GENERATED PROPOSAL - REVIEW_REQUIRED';
const APPROVED_HEADER_MARKER = 'HUMAN-APPROVED AUTOMATION';

function now(): string { return new Date().toISOString(); }

function assertRequirementId(requirementId: string): void {
  if (!/^[A-Za-z0-9._-]+$/.test(requirementId)) {
    throw new Error(`Invalid requirement id '${requirementId}'. Allowed characters: letters, numbers, dot, underscore and hyphen.`);
  }
}

function requirementDir(root: string, requirementId: string): string {
  assertRequirementId(requirementId);
  return join(root, 'generated', 'requirements', requirementId);
}

function safeProjectPath(root: string, projectRelativePath: string): string {
  return resolveWorkspacePath(root, projectRelativePath);
}

async function exists(path: string): Promise<boolean> {
  try { await access(path); return true; } catch { return false; }
}

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T;
}

function inferKind(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  if (normalized.startsWith('tests/') || normalized.includes('/tests/')) return 'test';
  if (normalized.includes('/pages/')) return 'page';
  if (normalized.includes('/components/')) return 'component';
  if (normalized.includes('/workflows/')) return 'workflow';
  if (normalized.includes('/database/') || normalized.includes('/db/')) return 'db-repository';
  if (normalized.includes('/api/')) return 'api-service';
  return 'generated-file';
}

async function loadGenerationManifest(root: string, requirementId: string): Promise<GenerationManifest> {
  const path = join(requirementDir(root, requirementId), 'generation-manifest.json');
  if (!(await exists(path))) throw new Error(`Generation manifest not found for '${requirementId}'. Run requirement:generate first.`);
  const manifest = await readJson<GenerationManifest>(path);
  if (manifest.requirementId !== requirementId) throw new Error(`Generation manifest requirement mismatch: expected '${requirementId}', got '${manifest.requirementId}'.`);
  return manifest;
}

async function scanGeneratedOwnership(root: string, requirementId: string): Promise<ProposalEntry[]> {
  const roots = ['projects', 'tests'];
  const found: ProposalEntry[] = [];
  const visit = async (directory: string): Promise<void> => {
    if (!(await exists(directory))) return;
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) { await visit(absolute); continue; }
      if (!entry.isFile() || !/\.(?:ts|tsx|js|mjs|cjs)$/.test(entry.name)) continue;
      const text = await readFile(absolute, 'utf8');
      if (text.includes(GENERATED_HEADER_MARKER) && text.includes(`Requirement: ${requirementId}`)) {
        const path = relative(root, absolute).replace(/\\/g, '/');
        found.push({ kind: inferKind(path), path });
      }
    }
  };
  for (const candidate of roots) await visit(join(root, candidate));
  return found;
}

async function proposalEntries(root: string, requirementId: string, manifest?: GenerationManifest): Promise<ProposalEntry[]> {
  const source = manifest ?? await loadGenerationManifest(root, requirementId);
  const byPath = new Map<string, ProposalEntry>();
  for (const item of source.created ?? []) {
    if (item?.path) byPath.set(item.path.replace(/\\/g, '/'), { kind: item.kind, path: item.path.replace(/\\/g, '/') });
  }
  // Backward compatibility for older manifests whose rerun accidentally stored an empty created[] list.
  if (!byPath.size) {
    for (const item of await scanGeneratedOwnership(root, requirementId)) byPath.set(item.path, item);
  }
  return [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path));
}

async function loadReviewState(root: string, requirementId: string): Promise<ProposalReviewState | undefined> {
  const path = join(requirementDir(root, requirementId), 'review.json');
  return await exists(path) ? readJson<ProposalReviewState>(path) : undefined;
}

async function saveReviewState(root: string, state: ProposalReviewState): Promise<void> {
  const path = join(requirementDir(root, state.requirementId), 'review.json');
  await mkdir(requirementDir(root, state.requirementId), { recursive: true });
  await writeFile(path, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

async function appendAudit(root: string, requirementId: string, event: ProposalReviewEvent): Promise<void> {
  const dir = requirementDir(root, requirementId);
  await mkdir(dir, { recursive: true });
  await appendFile(join(dir, 'review-audit.jsonl'), `${JSON.stringify({ requirementId, ...event })}\n`, 'utf8');
}

function snapshotPath(root: string, requirementId: string, projectRelativePath: string): string {
  return join(requirementDir(root, requirementId), 'proposal-snapshot', projectRelativePath);
}

async function ensureSnapshot(root: string, requirementId: string, entry: ProposalEntry, refresh = false): Promise<void> {
  const source = safeProjectPath(root, entry.path);
  if (!(await exists(source))) return;
  const snapshot = snapshotPath(root, requirementId, entry.path);
  if (!refresh && await exists(snapshot)) return;
  await mkdir(join(snapshot, '..'), { recursive: true });
  await copyFile(source, snapshot);
}

/**
 * Reusable framework function `initializeProposalReview`.
 * Business Use: Centralizes shared TestigentAI behavior so project teams do not duplicate framework logic.
 * Benefit: Keeps behavior consistent, reviewable and reusable across organizations and applications.
 */
export async function initializeProposalReview(
  root: string,
  manifest: GenerationManifest,
  changedPaths: string[] = []
): Promise<ProposalReviewState> {
  const requirementId = manifest.requirementId;
  const entries = await proposalEntries(root, requirementId, manifest);
  const changed = new Set(changedPaths.map(item => item.replace(/\\/g, '/')));
  for (const entry of entries) await ensureSnapshot(root, requirementId, entry, changed.has(entry.path));

  const existing = await loadReviewState(root, requirementId);
  if (!existing) {
    const at = now();
    const state: ProposalReviewState = {
      version: 1,
      requirementId,
      status: 'REVIEW_REQUIRED',
      targetApplication: manifest.targetApplication,
      initializedAt: at,
      updatedAt: at,
      generationCreatedAt: manifest.createdAt,
      events: [{ at, action: 'INITIALIZED', note: 'Generated proposal registered for explicit human review.' }]
    };
    await saveReviewState(root, state);
    await appendAudit(root, requirementId, state.events[0]!);
    return state;
  }

  existing.targetApplication = manifest.targetApplication ?? existing.targetApplication;
  existing.generationCreatedAt = manifest.createdAt;
  if (changed.size && existing.status !== 'REVIEW_REQUIRED') {
    const at = now();
    existing.status = 'REVIEW_REQUIRED';
    existing.updatedAt = at;
    existing.reviewer = undefined;
    existing.decisionNote = undefined;
    existing.approvedAt = undefined;
    existing.rejectedAt = undefined;
    existing.promotedAt = undefined;
    existing.approvedFileHashes = undefined;
    const event: ProposalReviewEvent = { at, action: 'GENERATION_CHANGED', note: 'Generated proposal changed; previous decision was invalidated and review is required again.' };
    existing.events.push(event);
    await appendAudit(root, requirementId, event);
  }
  await saveReviewState(root, existing);
  return existing;
}

function stripOwnershipHeader(text: string): string {
  if (!text.startsWith('/**')) return text;
  const end = text.indexOf('*/');
  return end >= 0 ? text.slice(end + 2) : text;
}

function blockingMarkers(text: string, kind?: string): string[] {
  const body = stripOwnershipHeader(text);
  const found: string[] = [];
  if (/\btest\.fixme\s*\(/.test(body)) found.push('test.fixme execution guard is still present');
  if (/REVIEW_REQUIRED/i.test(body)) found.push('REVIEW_REQUIRED implementation marker is still present');

  if (kind === 'page' || kind === 'component') {
    const directAction = /(?:await\s+)?(?:this\.)?[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\([^;\n]*\))*\.(?:click|fill|press|check|uncheck|selectOption)\s*\(/g;
    const matches = body.match(directAction) ?? [];
    const unsafe = matches.filter(item => !/healer\.|healing(?:Click|Fill|FillAndPress)/.test(item));
    if (unsafe.length) found.push('direct Playwright UI action bypasses the HealingOrchestrator contract');
    if (!/LocatorPlan/.test(body)) found.push('healing-aware LocatorPlan is missing from generated UI abstraction');
  }
  if (kind === 'db-repository') {
    const mutatingSql = /\b(?:INSERT\s+INTO|UPDATE\s+[A-Za-z0-9_."`\[\]]+\s+SET|DELETE\s+FROM|MERGE\s+INTO|DROP\s+(?:TABLE|DATABASE)|TRUNCATE\s+TABLE|ALTER\s+TABLE)\b/i;
    if (mutatingSql.test(body)) found.push('agent-generated database validation must remain read-only; mutating/destructive SQL requires a separate human-owned data setup path');
  }
  if (kind === 'api-service') {
    if (/\bAPIRequestContext\b/.test(body) || /\brequest\.(?:fetch|get|post|put|patch|delete)\s*\(/.test(body)) {
      found.push('generated API service bypasses the project BaseApiClient/domain-service contract');
    }
  }
  return found;
}

async function loadPromotionManifest(root: string, requirementId: string): Promise<PromotionManifest | undefined> {
  const path = join(requirementDir(root, requirementId), 'promotion-manifest.json');
  return await exists(path) ? readJson<PromotionManifest>(path) : undefined;
}

/**
 * Reusable framework function `inspectProposal`.
 * Business Use: Centralizes shared TestigentAI behavior so project teams do not duplicate framework logic.
 * Benefit: Keeps behavior consistent, reviewable and reusable across organizations and applications.
 */
export async function inspectProposal(root: string, requirementId: string): Promise<ProposalInspection> {
  const manifest = await loadGenerationManifest(root, requirementId);
  let state = await loadReviewState(root, requirementId);
  if (!state) state = await initializeProposalReview(root, manifest);

  const promotion = state.status === 'PROMOTED' ? await loadPromotionManifest(root, requirementId) : undefined;
  const entries: ProposalEntry[] = promotion
    ? promotion.files.map(item => ({ kind: item.kind, path: item.to }))
    : await proposalEntries(root, requirementId, manifest);
  const files: ProposalFileInspection[] = [];
  const issues: string[] = [];

  for (const entry of entries) {
    const absolute = safeProjectPath(root, entry.path);
    const fileExists = await exists(absolute);
    if (!fileExists) {
      files.push({ kind: entry.kind, path: entry.path, exists: false, ownedByRequirement: false, promoted: state.status === 'PROMOTED', blockingMarkers: [] });
      issues.push(`Missing proposal file: ${entry.path}`);
      continue;
    }
    const text = await readFile(absolute, 'utf8');
    const promoted = state.status === 'PROMOTED';
    const owned = promoted
      ? text.includes(APPROVED_HEADER_MARKER) && text.includes(`Requirement: ${requirementId}`)
      : text.includes(GENERATED_HEADER_MARKER) && text.includes(`Requirement: ${requirementId}`);
    if (!owned) issues.push(`${entry.path} no longer has the expected ${promoted ? 'human-approved' : 'generated ownership'} header for requirement ${requirementId}.`);
    const hash = sha256(text);
    const snapshot = snapshotPath(root, requirementId, entry.path);
    const snapshotText = !promoted && await exists(snapshot) ? await readFile(snapshot, 'utf8') : undefined;
    const markers = promoted ? [] : blockingMarkers(text, entry.kind);
    for (const marker of markers) issues.push(`${entry.path}: ${marker}.`);
    files.push({
      kind: entry.kind,
      path: entry.path,
      exists: true,
      ownedByRequirement: owned,
      promoted,
      sha256: hash,
      snapshotSha256: snapshotText ? sha256(snapshotText) : undefined,
      changedFromGeneratedSnapshot: snapshotText ? sha256(snapshotText) !== hash : undefined,
      blockingMarkers: markers
    });
  }

  if (!files.length) issues.push('No proposal-owned files were found. Regenerate the requirement proposal before review.');
  const clean = !issues.length;
  return {
    requirementId,
    status: state.status,
    targetApplication: state.targetApplication,
    approvable: (state.status === 'REVIEW_REQUIRED' || state.status === 'APPROVED') && clean,
    promotable: state.status === 'APPROVED' && clean,
    files,
    issues,
    reviewer: state.reviewer,
    decisionNote: state.decisionNote
  };
}

function reviewerFrom(value?: string): string {
  const reviewer = value?.trim() || process.env.PROPOSAL_REVIEWER?.trim();
  if (!reviewer) throw new Error('Human reviewer is required. Pass --reviewer=<name> or set PROPOSAL_REVIEWER.');
  return reviewer;
}

export interface ProposalReviewOptions { runTypecheck?: boolean; }

function runTypecheck(root: string, options?: ProposalReviewOptions): void {
  if (options?.runTypecheck === false) return;
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npm, ['run', 'typecheck'], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`Typecheck failed; proposal decision/promotion blocked.\n${result.stdout ?? ''}${result.stderr ?? ''}`.trim());
  }
}

/**
 * Reusable framework function `validateProposal`.
 * Business Use: Centralizes shared TestigentAI behavior so project teams do not duplicate framework logic.
 * Benefit: Keeps behavior consistent, reviewable and reusable across organizations and applications.
 */
export async function validateProposal(root: string, requirementId: string): Promise<ProposalInspection> {
  const inspection = await inspectProposal(root, requirementId);
  if (inspection.issues.length) {
    throw new Error(`Proposal '${requirementId}' is not review-clean:\n- ${inspection.issues.join('\n- ')}`);
  }
  return inspection;
}

/**
 * Reusable framework function `approveProposal`.
 * Business Use: Centralizes shared TestigentAI behavior so project teams do not duplicate framework logic.
 * Benefit: Keeps behavior consistent, reviewable and reusable across organizations and applications.
 */
export async function approveProposal(root: string, requirementId: string, reviewerValue?: string, note?: string, options?: ProposalReviewOptions): Promise<ProposalReviewState> {
  const reviewer = reviewerFrom(reviewerValue);
  const inspection = await inspectProposal(root, requirementId);
  if (inspection.status === 'PROMOTED') throw new Error(`Proposal '${requirementId}' is already promoted.`);
  if (inspection.status === 'REJECTED') throw new Error(`Proposal '${requirementId}' is REJECTED. Reopen it before approval.`);
  if (!inspection.approvable) throw new Error(`Proposal '${requirementId}' cannot be approved:\n- ${inspection.issues.join('\n- ')}`);
  runTypecheck(root, options);

  const state = (await loadReviewState(root, requirementId))!;
  const at = now();
  state.status = 'APPROVED';
  state.updatedAt = at;
  state.reviewer = reviewer;
  state.decisionNote = note?.trim() || 'Human review completed; proposal approved for promotion.';
  state.approvedAt = at;
  state.rejectedAt = undefined;
  state.promotedAt = undefined;
  state.approvedFileHashes = Object.fromEntries(inspection.files.map(file => [file.path, file.sha256!]));
  const event: ProposalReviewEvent = { at, action: 'APPROVED', reviewer, note: state.decisionNote };
  state.events.push(event);
  await saveReviewState(root, state);
  await appendAudit(root, requirementId, event);
  return state;
}

/**
 * Reusable framework function `rejectProposal`.
 * Business Use: Centralizes shared TestigentAI behavior so project teams do not duplicate framework logic.
 * Benefit: Keeps behavior consistent, reviewable and reusable across organizations and applications.
 */
export async function rejectProposal(root: string, requirementId: string, reviewerValue?: string, reason?: string): Promise<ProposalReviewState> {
  const reviewer = reviewerFrom(reviewerValue);
  const message = reason?.trim();
  if (!message) throw new Error('Rejection reason is required. Pass --reason="...".');
  await loadGenerationManifest(root, requirementId);
  let state = await loadReviewState(root, requirementId);
  if (!state) state = await initializeProposalReview(root, await loadGenerationManifest(root, requirementId));
  if (state.status === 'PROMOTED') throw new Error(`Promoted automation '${requirementId}' cannot be rejected through proposal review. Change it through the normal code-review workflow.`);
  const at = now();
  state.status = 'REJECTED';
  state.updatedAt = at;
  state.reviewer = reviewer;
  state.decisionNote = message;
  state.approvedAt = undefined;
  state.rejectedAt = at;
  state.approvedFileHashes = undefined;
  const event: ProposalReviewEvent = { at, action: 'REJECTED', reviewer, note: message };
  state.events.push(event);
  await saveReviewState(root, state);
  await appendAudit(root, requirementId, event);
  return state;
}

/**
 * Reusable framework function `reopenProposal`.
 * Business Use: Centralizes shared TestigentAI behavior so project teams do not duplicate framework logic.
 * Benefit: Keeps behavior consistent, reviewable and reusable across organizations and applications.
 */
export async function reopenProposal(root: string, requirementId: string, reviewerValue?: string, note?: string): Promise<ProposalReviewState> {
  const reviewer = reviewerFrom(reviewerValue);
  const manifest = await loadGenerationManifest(root, requirementId);
  let state = await loadReviewState(root, requirementId);
  if (!state) state = await initializeProposalReview(root, manifest);
  if (state.status === 'PROMOTED') throw new Error(`Promoted automation '${requirementId}' cannot be reopened as a proposal.`);
  const at = now();
  state.status = 'REVIEW_REQUIRED';
  state.updatedAt = at;
  state.reviewer = reviewer;
  state.decisionNote = note?.trim() || 'Proposal reopened for additional human review.';
  state.approvedAt = undefined;
  state.rejectedAt = undefined;
  state.approvedFileHashes = undefined;
  const event: ProposalReviewEvent = { at, action: 'REOPENED', reviewer, note: state.decisionNote };
  state.events.push(event);
  await saveReviewState(root, state);
  await appendAudit(root, requirementId, event);
  return state;
}

function approvedContent(text: string, requirementId: string): string {
  if (!text.startsWith('/**')) throw new Error('Generated ownership header must remain until promotion.');
  const end = text.indexOf('*/');
  if (end < 0) throw new Error('Generated ownership header is malformed.');
  const first = text.slice(0, end + 2);
  if (!first.includes(GENERATED_HEADER_MARKER) || !first.includes(`Requirement: ${requirementId}`)) {
    throw new Error(`Generated ownership header for requirement '${requirementId}' is missing.`);
  }
  const replacement = `/**\n * HUMAN-APPROVED AUTOMATION\n * Requirement: ${requirementId}\n * Promoted from generated proposal after explicit human review.\n * Author: Raushan Raj\n */`;
  return replacement + text.slice(end + 2);
}

function promotedTarget(path: string, kind: string): string {
  if (kind === 'test' && path.endsWith('.generated.spec.ts')) return path.replace(/\.generated\.spec\.ts$/, '.spec.ts');
  if (kind === 'test' && path.endsWith('.generated.test.ts')) return path.replace(/\.generated\.test\.ts$/, '.test.ts');
  return path;
}

async function restoreFromBackup(root: string, backupRoot: string, mappings: Array<{ from: string; to: string }>): Promise<void> {
  for (const mapping of [...mappings].reverse()) {
    const source = safeProjectPath(root, mapping.from);
    const target = safeProjectPath(root, mapping.to);
    if (mapping.to !== mapping.from && await exists(target)) await unlink(target).catch(() => undefined);
    const backup = join(backupRoot, mapping.from);
    if (await exists(backup)) {
      await mkdir(join(source, '..'), { recursive: true });
      await copyFile(backup, source);
    }
  }
}

/**
 * Reusable framework function `promoteProposal`.
 * Business Use: Centralizes shared TestigentAI behavior so project teams do not duplicate framework logic.
 * Benefit: Keeps behavior consistent, reviewable and reusable across organizations and applications.
 */
export async function promoteProposal(root: string, requirementId: string, options?: ProposalReviewOptions): Promise<PromotionManifest> {
  const state = await loadReviewState(root, requirementId);
  if (!state || state.status !== 'APPROVED') throw new Error(`Proposal '${requirementId}' must be APPROVED before promotion.`);
  const inspection = await inspectProposal(root, requirementId);
  if (inspection.issues.length) throw new Error(`Proposal '${requirementId}' is not promotion-clean:\n- ${inspection.issues.join('\n- ')}`);
  if (!state.approvedFileHashes) throw new Error(`Proposal '${requirementId}' has no approved file hashes. Approve it again before promotion.`);

  for (const file of inspection.files) {
    const approvedHash = state.approvedFileHashes[file.path];
    if (!approvedHash || approvedHash !== file.sha256) {
      throw new Error(`Proposal changed after approval: ${file.path}. Reopen/review/approve again before promotion.`);
    }
  }
  runTypecheck(root, options);

  const mappings = inspection.files.map(file => ({ kind: file.kind, from: file.path, to: promotedTarget(file.path, file.kind), sha256: file.sha256! }));
  for (const mapping of mappings) {
    if (mapping.to !== mapping.from && await exists(safeProjectPath(root, mapping.to))) {
      throw new Error(`Promotion target already exists and will not be overwritten: ${mapping.to}`);
    }
  }

  const stamp = now().replace(/[:.]/g, '-');
  const backupRoot = join(root, '.proposal-backups', requirementId, stamp);
  await mkdir(backupRoot, { recursive: true });
  for (const mapping of mappings) {
    const source = safeProjectPath(root, mapping.from);
    const backup = join(backupRoot, mapping.from);
    await mkdir(join(backup, '..'), { recursive: true });
    await copyFile(source, backup);
  }

  try {
    for (const mapping of mappings) {
      const source = safeProjectPath(root, mapping.from);
      const target = safeProjectPath(root, mapping.to);
      const transformed = approvedContent(await readFile(source, 'utf8'), requirementId);
      await mkdir(join(target, '..'), { recursive: true });
      await writeFile(target, transformed, 'utf8');
      if (mapping.to !== mapping.from) await unlink(source);
    }
    runTypecheck(root, options);
  } catch (error) {
    await restoreFromBackup(root, backupRoot, mappings);
    throw new Error(`Promotion failed and project files were rolled back. ${error instanceof Error ? error.message : String(error)}`);
  }

  const at = now();
  const manifest: PromotionManifest = {
    version: 1,
    requirementId,
    reviewer: state.reviewer ?? 'unknown-reviewer',
    promotedAt: at,
    backupDirectory: relative(root, backupRoot).replace(/\\/g, '/'),
    files: mappings.map(item => ({ ...item, sha256: item.sha256 }))
  };
  await writeFile(join(requirementDir(root, requirementId), 'promotion-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  state.status = 'PROMOTED';
  state.updatedAt = at;
  state.promotedAt = at;
  const event: ProposalReviewEvent = { at, action: 'PROMOTED', reviewer: state.reviewer, note: 'Approved proposal promoted into active automation. No git commit or merge was performed.' };
  state.events.push(event);
  await saveReviewState(root, state);
  await appendAudit(root, requirementId, event);
  return manifest;
}

/**
 * Reusable framework function `listProposals`.
 * Business Use: Centralizes shared TestigentAI behavior so project teams do not duplicate framework logic.
 * Benefit: Keeps behavior consistent, reviewable and reusable across organizations and applications.
 */
export async function listProposals(root: string): Promise<Array<{ requirementId: string; status: ProposalReviewStatus; targetApplication?: string; reviewer?: string }>> {
  const base = join(root, 'generated', 'requirements');
  if (!(await exists(base))) return [];
  const directories = (await readdir(base, { withFileTypes: true })).filter(entry => entry.isDirectory());
  const output: Array<{ requirementId: string; status: ProposalReviewStatus; targetApplication?: string; reviewer?: string }> = [];
  for (const directory of directories) {
    if (!/^[A-Za-z0-9._-]+$/.test(directory.name)) continue;
    const manifestPath = join(base, directory.name, 'generation-manifest.json');
    if (!(await exists(manifestPath))) continue;
    const manifest = await readJson<GenerationManifest>(manifestPath);
    let state = await loadReviewState(root, directory.name);
    if (!state) state = await initializeProposalReview(root, manifest);
    output.push({ requirementId: directory.name, status: state.status, targetApplication: state.targetApplication, reviewer: state.reviewer });
  }
  return output.sort((a, b) => a.requirementId.localeCompare(b.requirementId));
}
