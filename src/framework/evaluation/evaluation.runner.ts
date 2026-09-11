import type {
  AiEvaluationCase,
  AiEvaluationMetric,
  AiEvaluationResult,
} from './evaluation.types';

/**
 * Reusable bounded-concurrency AI/agent evaluation runner.
 * Business Use: Runs deterministic or external evaluation adapters without coupling tests to a vendor SDK.
 * Benefit: Keeps quality gates portable while preventing unbounded LLM/API concurrency in CI.
 */
export class AiEvaluationRunner {
  constructor(
    private readonly metrics: AiEvaluationMetric[],
    private readonly concurrency = 4,
  ) {
    if (!Number.isInteger(concurrency) || concurrency < 1) {
      throw new Error(`Evaluation concurrency must be a positive integer; received ${concurrency}.`);
    }
    if (metrics.length === 0) throw new Error('At least one evaluation metric is required.');
  }

  /** Run all configured metrics for one case and aggregate the pass/fail outcome. */
  async evaluateCase(testCase: AiEvaluationCase): Promise<AiEvaluationResult> {
    const metrics = await Promise.all(this.metrics.map(metric => metric.evaluate(testCase)));
    return {
      caseId: testCase.caseId,
      passed: metrics.every(metric => metric.passed),
      metrics,
    };
  }

  /** Run a dataset with bounded concurrency while preserving input order in the returned result array. */
  async evaluateDataset(cases: AiEvaluationCase[]): Promise<AiEvaluationResult[]> {
    const results = new Array<AiEvaluationResult>(cases.length);
    let next = 0;
    const worker = async (): Promise<void> => {
      while (true) {
        const index = next++;
        if (index >= cases.length) return;
        results[index] = await this.evaluateCase(cases[index]);
      }
    };
    await Promise.all(Array.from({ length: Math.min(this.concurrency, cases.length) }, () => worker()));
    return results;
  }
}
