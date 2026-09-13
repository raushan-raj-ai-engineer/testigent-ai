import fs from 'node:fs';
import path from 'node:path';

type Lane = 'core' | 'ai';
interface Marker {
  schemaVersion?: number;
  lane?: Lane;
  shardIndex?: number;
  shardTotal?: number;
  hasTests?: boolean | null;
  application?: string;
  environment?: string;
  runId?: string;
}
interface Candidate {
  marker: Required<Pick<Marker, 'lane' | 'shardIndex' | 'shardTotal'>> & Marker;
  markerFile: string;
  artifactRoot: string;
  attempt: number;
}
interface SelectedSource {
  lane: Lane;
  shardIndex: number;
  shardTotal: number;
  sourceRunId: string;
  sourceAttempt: number;
  hasTests: boolean | null;
  businessArtifact: string;
  blobArtifact?: string;
}

/**
 * Author: Raushan Raj
 * Business Use: Resolves report artifacts safely across GitHub failed-job reruns where successful shards are not executed again.
 * How to use: Download all same-workflow-run business/blob artifacts, then run this script before validation/merge.
 * Benefit: Reuses only provenance-compatible prior-attempt shards, preventing both missing reports and accidental cross-run artifact mixing.
 */
export function resolveRerunArtifacts(args = process.argv.slice(2)): SelectedSource[] {
  const [rawBusinessArg = 'all-business-reports-raw', resolvedBusinessArg = 'all-business-reports', rawBlobArg = 'all-blob-reports-raw', resolvedBlobArg = 'all-blob-reports'] = args;
  const rawBusiness = path.resolve(rawBusinessArg);
  const resolvedBusiness = path.resolve(resolvedBusinessArg);
  const rawBlob = path.resolve(rawBlobArg);
  const resolvedBlob = path.resolve(resolvedBlobArg);

  const app = requiredEnv('APP');
  const environment = requiredEnv('ENV');
  const currentRunId = requiredEnv('RUN_ID');
  const workflowRunId = clean(process.env.CI_WORKFLOW_RUN_ID) ?? deriveWorkflowRunId(currentRunId);
  const currentAttempt = integerEnv('CI_WORKFLOW_RUN_ATTEMPT') ?? parseAttempt(currentRunId, workflowRunId);
  const expectedCore = positiveIntegerEnv('EXPECTED_CORE_WORKERS');
  if (expectedCore === undefined) throw new Error('EXPECTED_CORE_WORKERS is required for rerun artifact resolution.');
  const expectAi = booleanEnv('EXPECT_AI_LANE');

  const candidates = walk(rawBusiness)
    .filter(file => path.basename(file) === 'ci-bundle.json')
    .map(file => toCandidate(file, rawBusiness, app, environment, workflowRunId, currentAttempt));

  const selected: Candidate[] = [];
  for (let shardIndex = 1; shardIndex <= expectedCore; shardIndex += 1) {
    const shardCandidates = candidates.filter(candidate => candidate.marker.lane === 'core' && candidate.marker.shardIndex === shardIndex && candidate.marker.shardTotal === expectedCore);
    if (!shardCandidates.length) {
      throw new Error(`Rerun artifact resolution is incomplete: no core shard ${shardIndex}/${expectedCore} exists for workflow run ${workflowRunId}.`);
    }
    selected.push(selectLatestUnique(shardCandidates, `core shard ${shardIndex}/${expectedCore}`));
  }

  if (expectAi) {
    const aiCandidates = candidates.filter(candidate => candidate.marker.lane === 'ai');
    if (!aiCandidates.length) throw new Error(`AI lane succeeded but no AI business artifact exists for workflow run ${workflowRunId}.`);
    const ai = selectLatestUnique(aiCandidates, 'AI lane');
    if (ai.attempt !== currentAttempt) {
      throw new Error(`AI lane succeeded for attempt ${currentAttempt}, but newest AI artifact is attempt ${ai.attempt}; refusing stale AI evidence.`);
    }
    selected.push(ai);
  }

  recreateDirectory(resolvedBusiness);
  recreateDirectory(resolvedBlob);
  const manifest: SelectedSource[] = [];

  for (const candidate of selected) {
    const lane = candidate.marker.lane;
    const shard = candidate.marker.shardIndex;
    const destinationName = lane === 'core'
      ? `core-${shard}-attempt-${candidate.attempt}`
      : `ai-attempt-${candidate.attempt}`;
    validateSelectedBusinessArtifact(candidate);
    const businessDestination = path.join(resolvedBusiness, destinationName);
    fs.cpSync(candidate.artifactRoot, businessDestination, { recursive: true });

    const sourceRunId = String(candidate.marker.runId);
    const blobArtifactName = lane === 'core'
      ? `blob-${app}-${sourceRunId}-core-${shard}`
      : `blob-${app}-${sourceRunId}-ai`;
    const blobArtifactRoot = findArtifactRoot(rawBlob, blobArtifactName);
    const hasTests = candidate.marker.hasTests ?? null;
    if (hasTests === true && !blobArtifactRoot) {
      throw new Error(`Selected ${lane} evidence ${sourceRunId} requires technical blob artifact '${blobArtifactName}', but it was not downloaded.`);
    }
    if (blobArtifactRoot) copyBlobFilesFlat(blobArtifactRoot, resolvedBlob, `${lane}-${shard}-a${candidate.attempt}`);

    manifest.push({
      lane,
      shardIndex: shard,
      shardTotal: candidate.marker.shardTotal,
      sourceRunId,
      sourceAttempt: candidate.attempt,
      hasTests,
      businessArtifact: path.basename(candidate.artifactRoot),
      ...(blobArtifactRoot ? { blobArtifact: path.basename(blobArtifactRoot) } : {})
    });
  }

  const resolution = {
    schemaVersion: 1,
    workflowRunId,
    currentRunId,
    currentAttempt,
    application: app,
    environment,
    expectedCoreWorkers: expectedCore,
    expectAiLane: expectAi,
    selected: manifest
  };
  fs.writeFileSync(path.join(resolvedBusiness, '_rerun-resolution.json'), JSON.stringify(resolution, null, 2));
  console.log(`[ci-report] resolved ${manifest.length} lane/shard source(s) for workflow run ${workflowRunId}, current attempt ${currentAttempt}`);
  for (const source of manifest) {
    console.log(`[ci-report] selected ${source.lane} ${source.shardIndex}/${source.shardTotal} from ${source.sourceRunId}`);
  }
  return manifest;
}

function toCandidate(file: string, rawRoot: string, app: string, environment: string, workflowRunId: string, currentAttempt: number): Candidate {
  const marker = JSON.parse(fs.readFileSync(file, 'utf8')) as Marker;
  if (marker.schemaVersion !== 1 || (marker.lane !== 'core' && marker.lane !== 'ai')) throw new Error(`Invalid CI bundle marker: ${file}`);
  const shardIndex = Number(marker.shardIndex);
  const shardTotal = Number(marker.shardTotal);
  if (!Number.isInteger(shardIndex) || !Number.isInteger(shardTotal) || shardIndex < 1 || shardTotal < 1 || shardIndex > shardTotal) {
    throw new Error(`Invalid CI bundle shard identity in ${file}`);
  }
  if (marker.application !== app || marker.environment !== environment) {
    throw new Error(`CI artifact provenance mismatch in ${file}: expected ${app}/${environment}, got ${String(marker.application)}/${String(marker.environment)}.`);
  }
  const sourceRunId = clean(marker.runId);
  if (!sourceRunId) throw new Error(`CI bundle marker is missing runId: ${file}`);
  const attempt = parseAttempt(sourceRunId, workflowRunId);
  if (attempt > currentAttempt) throw new Error(`CI artifact ${sourceRunId} is from future attempt ${attempt}; current attempt is ${currentAttempt}.`);
  return {
    marker: { ...marker, lane: marker.lane, shardIndex, shardTotal },
    markerFile: file,
    artifactRoot: artifactRootFor(file, rawRoot),
    attempt
  };
}

function validateSelectedBusinessArtifact(candidate: Candidate): void {
  const reportFiles = walk(candidate.artifactRoot).filter(file => path.basename(file) === 'business-report.json');
  const hasTests = candidate.marker.hasTests ?? null;
  if (hasTests === true && reportFiles.length !== 1) {
    throw new Error(`Selected ${candidate.marker.lane} artifact ${String(candidate.marker.runId)} declares tests but contains ${reportFiles.length} business-report.json file(s).`);
  }
  if (reportFiles.length > 1) {
    throw new Error(`Selected ${candidate.marker.lane} artifact ${String(candidate.marker.runId)} contains duplicate business-report.json files.`);
  }
  if (hasTests === false && reportFiles.length === 1) {
    try {
      const parsed = JSON.parse(fs.readFileSync(reportFiles[0]!, 'utf8')) as { results?: unknown[]; total?: unknown };
      const count = Array.isArray(parsed.results) ? parsed.results.length : typeof parsed.total === 'number' ? parsed.total : 0;
      if (count > 0) throw new Error(`marker says hasTests=false but report contains ${count} result(s)`);
    } catch (error) {
      throw new Error(`Selected ${candidate.marker.lane} artifact ${String(candidate.marker.runId)} has inconsistent no-test business evidence: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

function selectLatestUnique(candidates: Candidate[], label: string): Candidate {
  const maxAttempt = Math.max(...candidates.map(candidate => candidate.attempt));
  const latest = candidates.filter(candidate => candidate.attempt === maxAttempt);
  if (latest.length !== 1) {
    throw new Error(`Ambiguous ${label}: found ${latest.length} artifacts for attempt ${maxAttempt}; refusing nondeterministic provenance selection.`);
  }
  return latest[0]!;
}

function artifactRootFor(file: string, root: string): string {
  const relative = path.relative(root, file);
  const [first] = relative.split(path.sep);
  if (!first || first === 'ci-bundle.json') return path.dirname(file);
  return path.join(root, first);
}

function findArtifactRoot(root: string, artifactName: string): string | undefined {
  if (!fs.existsSync(root)) return undefined;
  const direct = path.join(root, artifactName);
  if (fs.existsSync(direct) && fs.statSync(direct).isDirectory()) return direct;
  return fs.readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name === artifactName)
    .map(entry => path.join(root, entry.name))[0];
}

function copyBlobFilesFlat(source: string, destination: string, prefix: string): void {
  const files = walk(source);
  for (const file of files) {
    const target = path.join(destination, `${prefix}-${path.basename(file)}`);
    if (fs.existsSync(target)) throw new Error(`Technical blob filename collision after provenance resolution: ${target}`);
    fs.copyFileSync(file, target);
  }
}

function deriveWorkflowRunId(runId: string): string {
  const match = /^(.*)-(\d+)$/.exec(runId);
  if (!match?.[1]) throw new Error(`RUN_ID '${runId}' does not contain an attempt suffix. Set CI_WORKFLOW_RUN_ID explicitly.`);
  return match[1];
}

function parseAttempt(runId: string, workflowRunId: string): number {
  const prefix = `${workflowRunId}-`;
  if (!runId.startsWith(prefix)) throw new Error(`Artifact runId '${runId}' does not belong to workflow run '${workflowRunId}'.`);
  const raw = runId.slice(prefix.length);
  const attempt = Number(raw);
  if (!Number.isInteger(attempt) || attempt < 1 || String(attempt) !== raw) throw new Error(`Artifact runId '${runId}' has an invalid workflow attempt suffix.`);
  return attempt;
}

function recreateDirectory(directory: string): void {
  fs.rmSync(directory, { recursive: true, force: true });
  fs.mkdirSync(directory, { recursive: true });
}

function requiredEnv(name: string): string {
  const value = clean(process.env[name]);
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
function positiveIntegerEnv(name: string): number | undefined {
  const value = integerEnv(name);
  if (value === undefined) return undefined;
  if (value < 1) throw new Error(`${name} must be a positive integer.`);
  return value;
}
function integerEnv(name: string): number | undefined {
  const raw = clean(process.env[name]);
  if (!raw) return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value)) throw new Error(`${name} must be an integer, received '${raw}'.`);
  return value;
}
function booleanEnv(name: string): boolean {
  const raw = clean(process.env[name])?.toLowerCase();
  if (!raw) return false;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  throw new Error(`${name} must be true or false, received '${process.env[name]}'.`);
}
function clean(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}
function walk(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  const output: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) output.push(...walk(full)); else output.push(full);
  }
  return output;
}

if (require.main === module) resolveRerunArtifacts();
