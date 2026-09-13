import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveRerunArtifacts } from './ci-resolve-rerun-artifacts';
import { validateDownloadedBundles } from './ci-validate-downloaded-bundles';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`CI_RERUN_ARTIFACT_CONTRACT_FAILED: ${message}`);
}
function writeBusinessArtifact(root: string, name: string, marker: Record<string, unknown>): void {
  const dir = path.join(root, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'ci-bundle.json'), JSON.stringify(marker, null, 2));
  if (marker.hasTests === true) fs.writeFileSync(path.join(dir, 'business-report.json'), JSON.stringify({ synthetic: true }));
}
function writeBlobArtifact(root: string, name: string): void {
  const dir = path.join(root, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'report.zip'), 'synthetic-blob');
}
function marker(lane: 'core' | 'ai', shardIndex: number, shardTotal: number, runId: string) {
  return { schemaVersion: 1, lane, shardIndex, shardTotal, hasTests: true, application: 'demo', environment: 'qa', runId };
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'testigent-rerun-artifacts-'));
const rawBusiness = path.join(root, 'business-raw');
const rawBlob = path.join(root, 'blob-raw');
const resolvedBusiness = path.join(root, 'business-resolved');
const resolvedBlob = path.join(root, 'blob-resolved');
fs.mkdirSync(rawBusiness, { recursive: true });
fs.mkdirSync(rawBlob, { recursive: true });

process.env.APP = 'demo';
process.env.ENV = 'qa';
process.env.RUN_ID = '90001-2';
process.env.CI_WORKFLOW_RUN_ID = '90001';
process.env.CI_WORKFLOW_RUN_ATTEMPT = '2';
process.env.EXPECTED_CORE_WORKERS = '2';
process.env.EXPECT_AI_LANE = 'true';

// Attempt 1 produced both core shards. A failed-only rerun produced only shard 1 and the AI lane.
writeBusinessArtifact(rawBusiness, 'business-demo-90001-1-core-1', marker('core', 1, 2, '90001-1'));
writeBusinessArtifact(rawBusiness, 'business-demo-90001-1-core-2', marker('core', 2, 2, '90001-1'));
writeBusinessArtifact(rawBusiness, 'business-demo-90001-2-core-1', marker('core', 1, 2, '90001-2'));
writeBusinessArtifact(rawBusiness, 'business-demo-90001-2-ai', marker('ai', 1, 1, '90001-2'));
for (const name of [
  'blob-demo-90001-1-core-1',
  'blob-demo-90001-1-core-2',
  'blob-demo-90001-2-core-1',
  'blob-demo-90001-2-ai'
]) writeBlobArtifact(rawBlob, name);

const selected = resolveRerunArtifacts([rawBusiness, resolvedBusiness, rawBlob, resolvedBlob]);
assert(selected.some(source => source.lane === 'core' && source.shardIndex === 1 && source.sourceRunId === '90001-2'), 'rerun shard 1 must use newest attempt');
assert(selected.some(source => source.lane === 'core' && source.shardIndex === 2 && source.sourceRunId === '90001-1'), 'non-rerun shard 2 must reuse prior attempt from same workflow run');
assert(selected.some(source => source.lane === 'ai' && source.sourceRunId === '90001-2'), 'successful AI lane must come from current attempt');
assert(fs.readdirSync(resolvedBlob).filter(name => name.endsWith('.zip')).length === 3, 'technical blobs must follow the same three provenance selections');

process.env.CI_ALLOW_SAME_WORKFLOW_PRIOR_ATTEMPTS = 'true';
validateDownloadedBundles(resolvedBusiness);

delete process.env.CI_ALLOW_SAME_WORKFLOW_PRIOR_ATTEMPTS;
let strictRejected = false;
try { validateDownloadedBundles(resolvedBusiness); } catch (error) { strictRejected = String(error).includes('provenance mismatch'); }
assert(strictRejected, 'prior-attempt reuse must be rejected unless the workflow explicitly enables same-run fallback');

// Exact observed main-CI failure mode: AI reruns/fails on attempt 2 while successful core shards remain on attempt 1.
process.env.EXPECT_AI_LANE = 'false';
const coreOnlyResolved = path.join(root, 'business-core-only');
const coreOnlyBlobs = path.join(root, 'blob-core-only');
const coreOnly = resolveRerunArtifacts([rawBusiness, coreOnlyResolved, rawBlob, coreOnlyBlobs]);
assert(coreOnly.length === 2 && coreOnly.every(source => source.lane === 'core'), 'failed AI rerun must resolve truthful core-only evidence and exclude the current AI marker');
process.env.CI_ALLOW_SAME_WORKFLOW_PRIOR_ATTEMPTS = 'true';
validateDownloadedBundles(coreOnlyResolved);
delete process.env.CI_ALLOW_SAME_WORKFLOW_PRIOR_ATTEMPTS;
process.env.EXPECT_AI_LANE = 'true';

// A foreign workflow run must be rejected even if app/env/shard look valid.
const foreignRoot = path.join(root, 'foreign-business');
fs.mkdirSync(foreignRoot, { recursive: true });
writeBusinessArtifact(foreignRoot, 'business-demo-99999-1-core-1', marker('core', 1, 2, '99999-1'));
let foreignRejected = false;
try { resolveRerunArtifacts([foreignRoot, path.join(root, 'foreign-resolved'), rawBlob, path.join(root, 'foreign-blob-resolved')]); } catch (error) { foreignRejected = String(error).includes("does not belong to workflow run '90001'"); }
assert(foreignRejected, 'foreign workflow-run artifacts must never be eligible for fallback');

console.log(JSON.stringify({ ok: true, selected: selected.map(source => `${source.lane}:${source.shardIndex}@${source.sourceAttempt}`) }, null, 2));
