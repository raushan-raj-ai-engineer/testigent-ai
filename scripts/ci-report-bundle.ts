import fs from 'node:fs';
import path from 'node:path';

/**
 * Author: Raushan Raj
 * Business Use: Writes a tiny lane/shard marker beside a CI business report so the merge stage can validate completeness without confusing core and AI artifacts.
 * How to use: Run `npm run ci:report:bundle -- core 1 2 true` or `npm run ci:report:bundle -- ai 1 1 true` before artifact upload.
 * Benefit: Sequential, sharded and optional AI executions share one merge path while missing shard/AI results fail closed.
 */
export function writeCiReportBundleMarker(args = process.argv.slice(2)): string {
  const [laneRaw = 'core', indexRaw = '1', totalRaw = '1', hasTestsRaw = 'true'] = args;
  if (laneRaw !== 'core' && laneRaw !== 'ai') throw new Error(`CI report lane must be core or ai, received '${laneRaw}'.`);
  const shardIndex = Number(indexRaw);
  const shardTotal = Number(totalRaw);
  if (!Number.isInteger(shardIndex) || !Number.isInteger(shardTotal) || shardIndex < 1 || shardTotal < 1 || shardIndex > shardTotal) {
    throw new Error(`Invalid CI shard identity ${indexRaw}/${totalRaw}.`);
  }
  const normalized = hasTestsRaw.trim().toLowerCase();
  const hasTests = normalized === 'true' ? true : normalized === 'false' ? false : null;
  const app = process.env.APP?.trim();
  if (!app) throw new Error('APP is required to write a CI report bundle marker.');
  const dir = path.resolve('reports', app, 'business');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'ci-bundle.json');
  fs.writeFileSync(file, JSON.stringify({
    schemaVersion: 1,
    lane: laneRaw,
    shardIndex,
    shardTotal,
    hasTests,
    application: app,
    environment: process.env.ENV?.trim() || undefined,
    runId: process.env.RUN_ID?.trim() || undefined,
    generatedAt: new Date().toISOString()
  }, null, 2));
  console.log(`[ci-report] wrote ${laneRaw} bundle marker ${shardIndex}/${shardTotal} (hasTests=${String(hasTests)}) -> ${file}`);
  return file;
}

if (require.main === module) writeCiReportBundleMarker();
