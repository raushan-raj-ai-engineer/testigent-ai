import fs from 'node:fs';
import path from 'node:path';
import type { RunContextData } from '../core/config/run.context';

export interface EvidenceRetentionResult {
  enabled: boolean;
  retentionDays: number;
  removedRunIds: string[];
}

/**
 * Enforces local generated-evidence retention using persisted run metadata rather than deleting unknown folders.
 * CI artifact retention remains the responsibility of the CI artifact store.
 */
export function enforceLocalEvidenceRetention(
  current: RunContextData,
  root = process.cwd(),
  env: NodeJS.ProcessEnv = process.env,
  now = Date.now(),
): EvidenceRetentionResult {
  const retentionDays = nonNegativeInteger(env.EVIDENCE_RETENTION_DAYS, 14);
  if (retentionDays === 0) return { enabled: false, retentionDays, removedRunIds: [] };
  const cutoff = now - retentionDays * 24 * 60 * 60 * 1000;
  const runsDir = path.resolve(root, '.runtime', 'runs');
  if (!fs.existsSync(runsDir)) return { enabled: true, retentionDays, removedRunIds: [] };

  const removedRunIds: string[] = [];
  for (const entry of fs.readdirSync(runsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const file = path.join(runsDir, entry.name);
    let data: RunContextData;
    try { data = JSON.parse(fs.readFileSync(file, 'utf8')) as RunContextData; }
    catch { continue; }
    if (!data.runId || data.runId === current.runId || !data.application || !data.environment) continue;
    const started = Date.parse(data.startedAt ?? '');
    if (!Number.isFinite(started) || started >= cutoff) continue;
    if (!safeSegment(data.runId) || !safeSegment(data.application) || !safeSegment(data.environment)) continue;

    fs.rmSync(path.resolve(root, 'reports', data.application, data.environment, data.runId), { recursive: true, force: true });
    fs.rmSync(path.resolve(root, 'test-results', data.application, data.environment, data.runId), { recursive: true, force: true });
    fs.rmSync(file, { force: true });
    clearLatestPointerIfMatching(root, data);
    removedRunIds.push(data.runId);
  }
  return { enabled: true, retentionDays, removedRunIds: removedRunIds.sort() };
}

function clearLatestPointerIfMatching(root: string, data: RunContextData): void {
  if (!data.application || !data.environment) return;
  const latest = path.resolve(root, '.runtime', 'latest-run', data.application, `${data.environment}.json`);
  if (!fs.existsSync(latest)) return;
  try {
    const pointer = JSON.parse(fs.readFileSync(latest, 'utf8')) as RunContextData;
    if (pointer.runId === data.runId) fs.rmSync(latest, { force: true });
  } catch {
    // Malformed convenience pointers are safe to remove; they are never authoritative run identity.
    fs.rmSync(latest, { force: true });
  }
}

function safeSegment(value: string): boolean { return /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value); }
function nonNegativeInteger(raw: string | undefined, fallback: number): number {
  const value = Number(raw ?? fallback);
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}
