import { createHash } from 'node:crypto';
import type { BusinessTestResult, FailureCluster } from './report.types';
import { normalizeFailureSignature } from './failure.normalizer';

/**
 * Author: Raushan Raj
 * Business Use: Deterministically groups repeated failures into common-cause clusters.
 * How to use: buildFailureClusters(results) after test execution; no LLM is required.
 * Benefit: Business and engineering teams focus on root causes rather than raw failure volume.
 */
export function buildFailureClusters(results: BusinessTestResult[]): FailureCluster[] {
  const clusters = new Map<string, FailureCluster>();
  for (const result of results.filter(item => item.status === 'failed')) {
    const category = result.failureCategory ?? 'UNKNOWN';
    const evidence = result.error ?? 'Unknown failure';
    const signature = `${category}: ${normalizeFailureSignature(evidence) || 'unknown failure'}`;
    const id = createHash('sha1').update(signature).digest('hex').slice(0, 10);
    const existing = clusters.get(signature);
    if (existing) {
      existing.affectedTests += 1;
      if (!existing.testTitles.includes(result.title)) existing.testTitles.push(result.title);
    } else {
      clusters.set(signature, {
        id,
        category,
        signature,
        evidence: evidence.slice(0, 240),
        affectedTests: 1,
        testTitles: [result.title]
      });
    }
  }
  return [...clusters.values()].sort((a, b) => b.affectedTests - a.affectedTests || a.id.localeCompare(b.id));
}
