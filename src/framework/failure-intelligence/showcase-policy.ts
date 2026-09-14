import type { FailureSignal } from './failure-intelligence.types.js';

/** Explicitly synthetic customer-demo dataset kept outside live evidence and product claims. */
export interface ShowcaseDataset {
  schemaVersion: 1;
  id: string;
  title: string;
  mode: 'SHOWCASE';
  synthetic: true;
  claimEligible: false;
  generatedFor: 'CUSTOMER_DEMO';
  scenarios: FailureSignal[];
  adoption: { applications: number; contributors: number; observations: number; timeToFirstPassingTestMinutes: number; requirementToApprovedTestMinutes: number; triageMedianMinutes: number };
  benchmark: { baseline: string; authoringTimeImprovementPercent: number; triageTimeImprovementPercent: number; reportCompletenessPercent: number };
  scale: { plannedCases: number; shards: number; workers: number; measured: false };
  apiContract: { operationsChecked: number; breakingChanges: number; validationFailures: number };
  healing: { validatedRecoveries: number; rejectedUnsafeCandidates: number; falseHeals: number };
  agentic: { plannerDecisions: number; generationProposals: number; reviewerRejections: number; mcpReadOnlyCalls: number };
}

/** Validates that customer showcase data is useful but permanently non-claimable and isolated. */
export function validateShowcaseDataset(value: ShowcaseDataset): void {
  if (value.schemaVersion !== 1 || value.mode !== 'SHOWCASE' || value.synthetic !== true || value.claimEligible !== false || value.generatedFor !== 'CUSTOMER_DEMO') {
    throw new Error('SHOWCASE_TRUST_BOUNDARY: dataset must be explicit synthetic customer-demo evidence.');
  }
  if (value.scenarios.length < 5 || value.scenarios.length > 10) throw new Error('SHOWCASE_SCENARIO_COUNT: provide between 5 and 10 realistic scenarios.');
  const ids = new Set<string>();
  for (const scenario of value.scenarios) {
    if (ids.has(scenario.scenarioId)) throw new Error(`SHOWCASE_DUPLICATE_SCENARIO: ${scenario.scenarioId}`);
    ids.add(scenario.scenarioId);
    if (scenario.evidenceMode !== 'SHOWCASE' || scenario.synthetic !== true || scenario.claimEligible !== false) throw new Error(`SHOWCASE_SCENARIO_TRUST_BOUNDARY: ${scenario.scenarioId}`);
  }
  if (value.scale.measured !== false) throw new Error('SHOWCASE_SCALE_BOUNDARY: synthetic showcase cannot represent measured scale certification.');
}
