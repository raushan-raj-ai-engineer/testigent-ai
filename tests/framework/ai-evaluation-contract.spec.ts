import { test, expect } from '@playwright/test';
import { AiEvaluationRunner } from '../../src/framework/evaluation/evaluation.runner';
import { ExactOutputMetric, RequiredFactsMetric } from '../../src/framework/evaluation/deterministic.metrics';

test.describe('provider-neutral AI evaluation contracts', () => {
  test('runs deterministic hard gates without a model-provider dependency', async () => {
    const runner = new AiEvaluationRunner([
      new ExactOutputMetric(),
      new RequiredFactsMetric(['approved', 'order-42']),
    ], 2);
    const [result] = await runner.evaluateDataset([{
      caseId: 'ai-001',
      input: 'Check order',
      expectedOutput: 'approved order-42',
      actualOutput: 'Approved   ORDER-42',
    }]);
    expect(result.passed).toBe(true);
    expect(result.metrics).toHaveLength(2);
  });
});
