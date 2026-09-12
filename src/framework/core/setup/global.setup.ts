import { RunContext } from '../config/run.context';
import { enforceLocalEvidenceRetention } from '../../logging/evidence.retention';

/**
 * Author: Raushan Raj
 * Business Use: Persists immutable run identity and enforces local generated-evidence retention before execution.
 * How to use: Configured as Playwright globalSetup; CI may provide RUN_ID or the framework creates one locally.
 * Benefit: Parallel workers share one identity without mutable global state, and old run evidence has an explicit lifecycle.
 */
export default async function globalSetup(): Promise<void> {
  const current = RunContext.persistCurrent();
  const retention = enforceLocalEvidenceRetention(current);
  if (retention.removedRunIds.length) {
    console.log(`[evidence-retention] removed ${retention.removedRunIds.length} expired local run(s): ${retention.removedRunIds.join(', ')}`);
  }
}
