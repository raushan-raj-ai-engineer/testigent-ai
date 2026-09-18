import { test, expect } from '../../fixtures/test.fixture';
import {
  captureWebPerformance,
  validateWebPerformanceBudget,
} from '../../../../src/framework/quality/performance.budget';

test.skip(
  process.env.RUN_EXTERNAL_TESTS !== 'true',
  'External public demo dependency; run with npm run test:external.',
);

test(
  'TodoMVC lightweight performance budget @performance @lane:performance @external',
  async ({ app, page }, testInfo) => {
    await app.todo.open();

    const snapshot = await captureWebPerformance(page);

    const budget = {
      domContentLoadedMs: 10_000,
      resourceCount: 100,
    };

    const violations = validateWebPerformanceBudget(
      snapshot,
      budget,
    );

    await testInfo.attach('web-performance.json', {
      body: JSON.stringify(
        {
          target: 'public-demo',
          enforcement:
            process.env.PERFORMANCE_BUDGET_ENFORCED === 'true'
              ? 'blocking'
              : 'advisory',
          snapshot,
          budget,
          violations,
        },
        null,
        2,
      ),
      contentType: 'application/json',
    });

    // Public demo performance is outside TestigentAI ownership.
    // Keep the evidence visible without making external latency
    // a release blocker. Real customer applications can opt in
    // to strict budget enforcement.
    if (
      violations.length > 0 &&
      process.env.PERFORMANCE_BUDGET_ENFORCED !== 'true'
    ) {
      testInfo.annotations.push({
        type: 'performance-advisory',
        description: violations.join('; '),
      });
    }

    if (
      process.env.PERFORMANCE_BUDGET_ENFORCED === 'true'
    ) {
      expect(violations).toEqual([]);
    }

    // The measurement itself must remain valid even in advisory mode.
    expect(snapshot.domContentLoadedMs).toBeGreaterThan(0);
    expect(snapshot.resourceCount).toBeGreaterThanOrEqual(0);
  },
);
