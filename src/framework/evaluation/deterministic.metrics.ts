import type { AiEvaluationCase, AiEvaluationMetric, AiMetricResult } from './evaluation.types';

/** Normalize textual output for deterministic comparison without changing its semantic content. */
function normalize(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Reusable exact-answer metric for stable contracts, golden responses, routing labels, and structured fixtures.
 * Business Use: Provides a zero-cost deterministic gate before optional probabilistic/LLM-as-judge metrics.
 * Benefit: Fast, explainable, provider-independent regression coverage.
 */
export class ExactOutputMetric implements AiEvaluationMetric {
  readonly name = 'exact-output';

  async evaluate(testCase: AiEvaluationCase): Promise<AiMetricResult> {
    if (testCase.expectedOutput === undefined) {
      return { metric: this.name, score: 0, passed: false, reason: 'expectedOutput is required.' };
    }
    const passed = normalize(testCase.actualOutput) === normalize(testCase.expectedOutput);
    return {
      metric: this.name,
      score: passed ? 1 : 0,
      passed,
      reason: passed ? 'Output matches the expected value.' : 'Output differs from the expected value.',
    };
  }
}

/**
 * Reusable required-facts metric for deterministic AI response contracts.
 * Business Use: Verifies that critical facts survive provider/model/prompt changes.
 * Benefit: Complements semantic judges with an auditable hard gate.
 */
export class RequiredFactsMetric implements AiEvaluationMetric {
  readonly name = 'required-facts';

  constructor(private readonly requiredFacts: string[], private readonly threshold = 1) {
    if (requiredFacts.length === 0) throw new Error('RequiredFactsMetric needs at least one fact.');
    if (threshold <= 0 || threshold > 1) throw new Error('RequiredFactsMetric threshold must be > 0 and <= 1.');
  }

  async evaluate(testCase: AiEvaluationCase): Promise<AiMetricResult> {
    const output = normalize(testCase.actualOutput);
    const matched = this.requiredFacts.filter(fact => output.includes(normalize(fact)));
    const score = matched.length / this.requiredFacts.length;
    return {
      metric: this.name,
      score,
      passed: score >= this.threshold,
      reason: `${matched.length}/${this.requiredFacts.length} required facts matched.`,
      details: { matched, missing: this.requiredFacts.filter(fact => !matched.includes(fact)) },
    };
  }
}
