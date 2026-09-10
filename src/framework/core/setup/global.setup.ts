import fs from 'node:fs';
import path from 'node:path';

/**
 * Author: Raushan Raj
 * Business Use: Creates one stable run identity before workers start.
 * How to use: Configured as Playwright globalSetup; CI may provide RUN_ID, GITHUB_RUN_ID or BUILD_BUILDID.
 * Benefit: UI/API/DB/healing logs from parallel workers can be correlated to the same execution.
 */
export default async function globalSetup(): Promise<void> {
  const runId = process.env.RUN_ID
    ?? (process.env.GITHUB_RUN_ID ? `github-${process.env.GITHUB_RUN_ID}` : undefined)
    ?? (process.env.BUILD_BUILDID ? `azure-${process.env.BUILD_BUILDID}` : undefined)
    ?? `local-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const file = path.resolve('.runtime/run-context.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ runId, startedAt: new Date().toISOString() }, null, 2));
}
