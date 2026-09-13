import fs from 'node:fs';
import path from 'node:path';

type Lane = 'core' | 'ai';
interface Marker {
  schemaVersion?: number;
  lane?: Lane;
  shardIndex?: number;
  shardTotal?: number;
  application?: string;
  environment?: string;
  runId?: string;
}

/**
 * Author: Raushan Raj
 * Business Use: Validates that GitHub report artifacts downloaded for merge belong to the current immutable run attempt and contain the expected core shard topology.
 * How to use: Run `npm run ci:report:download:validate -- all-business-reports` after artifact download and before report merge.
 * Benefit: Rerun artifact ambiguity fails early with actionable provenance diagnostics instead of surfacing later as a misleading incomplete business report.
 */
export function validateDownloadedBundles(rootArg = process.argv[2] ?? 'all-business-reports'): void {
  const root = path.resolve(rootArg);
  const files = walk(root);
  console.log(`[ci-report] current identity: ${process.env.APP ?? '<unset>'}/${process.env.ENV ?? '<unset>'}/${process.env.RUN_ID ?? '<unset>'}`);
  console.log(`[ci-report] downloaded ${files.length} file(s) under ${path.relative(process.cwd(), root) || '.'}`);
  for (const file of files.sort()) console.log(`[ci-report] file ${path.relative(root, file)}`);

  const markerFiles = files.filter(file => path.basename(file) === 'ci-bundle.json');
  const markers = markerFiles.map(file => ({ file, marker: parseMarker(file) }));
  const expectedCore = positiveIntegerEnv('EXPECTED_CORE_WORKERS');
  const expectedIdentity = {
    application: clean(process.env.APP),
    environment: clean(process.env.ENV),
    runId: clean(process.env.RUN_ID)
  };

  for (const { file, marker } of markers) {
    for (const field of ['application', 'environment', 'runId'] as const) {
      const expected = expectedIdentity[field];
      if (expected && marker[field] !== expected) {
        throw new Error(`Downloaded CI marker provenance mismatch: ${path.relative(process.cwd(), file)} has ${field}='${String(marker[field])}', expected '${expected}'.`);
      }
    }
  }

  const coreMarkers = markers.filter(item => item.marker.lane === 'core');
  const coreIdentities = new Set(coreMarkers.map(item => `${item.marker.shardIndex}/${item.marker.shardTotal}`));
  console.log(`[ci-report] core markers=${coreMarkers.length}, unique shards=${coreIdentities.size}, expected=${expectedCore ?? 'unspecified'}`);
  if (expectedCore !== undefined && coreIdentities.size !== expectedCore) {
    throw new Error(`Current-attempt business artifacts are incomplete: expected ${expectedCore} unique core marker(s), found ${coreIdentities.size}. RUN_ID=${expectedIdentity.runId ?? '<unset>'}`);
  }
}

function parseMarker(file: string): Marker {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Marker;
  if (parsed.schemaVersion !== 1 || (parsed.lane !== 'core' && parsed.lane !== 'ai')) {
    throw new Error(`Invalid CI bundle marker: ${file}`);
  }
  return parsed;
}

function positiveIntegerEnv(name: string): number | undefined {
  const raw = clean(process.env[name]);
  if (!raw) return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer, received '${raw}'.`);
  return value;
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

if (require.main === module) validateDownloadedBundles();
