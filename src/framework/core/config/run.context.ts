import fs from 'node:fs';
import path from 'node:path';

export interface RunContextData { runId: string; startedAt?: string; }

/**
 * Author: Raushan Raj
 * Business Use: Reads the stable execution identity shared by parallel workers.
 * How to use: RunContext.get().runId inside fixtures/reporting/logging.
 * Benefit: Reliable cross-layer correlation without relying on mutable global variables.
 */
export class RunContext {
  static get(): RunContextData {
    const file = path.resolve('.runtime/run-context.json');
    if (fs.existsSync(file)) {
      try { return JSON.parse(fs.readFileSync(file, 'utf8')) as RunContextData; } catch {}
    }
    return { runId: process.env.RUN_ID ?? 'unresolved-run' };
  }
}
