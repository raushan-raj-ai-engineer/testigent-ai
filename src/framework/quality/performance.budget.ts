import type { Page } from '@playwright/test';

export interface WebPerformanceSnapshot {
  domContentLoadedMs: number;
  loadMs: number;
  responseEndMs: number;
  resourceCount: number;
  transferBytes: number;
}

export interface WebPerformanceBudget {
  domContentLoadedMs?: number;
  loadMs?: number;
  responseEndMs?: number;
  resourceCount?: number;
  transferBytes?: number;
}

/** Captures browser Navigation/Resource Timing signals without adding a Lighthouse dependency. */
export async function captureWebPerformance(page: Page): Promise<WebPerformanceSnapshot> {
  return page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const transferBytes = resources.reduce((total, item) => total + (item.transferSize || 0), 0);
    return {
      domContentLoadedMs: Math.round(navigation?.domContentLoadedEventEnd ?? 0),
      loadMs: Math.round(navigation?.loadEventEnd ?? 0),
      responseEndMs: Math.round(navigation?.responseEnd ?? 0),
      resourceCount: resources.length,
      transferBytes,
    };
  });
}

/** Enforces explicit web-performance budgets and returns readable violations for reports. */
export function validateWebPerformanceBudget(snapshot: WebPerformanceSnapshot, budget: WebPerformanceBudget): string[] {
  const failures: string[] = [];
  check('domContentLoadedMs', snapshot.domContentLoadedMs, budget.domContentLoadedMs);
  check('loadMs', snapshot.loadMs, budget.loadMs);
  check('responseEndMs', snapshot.responseEndMs, budget.responseEndMs);
  check('resourceCount', snapshot.resourceCount, budget.resourceCount);
  check('transferBytes', snapshot.transferBytes, budget.transferBytes);
  return failures;

  function check(name: keyof WebPerformanceSnapshot, actual: number, maximum?: number): void {
    if (maximum !== undefined && actual > maximum) failures.push(`${name}: ${actual} > budget ${maximum}`);
  }
}
