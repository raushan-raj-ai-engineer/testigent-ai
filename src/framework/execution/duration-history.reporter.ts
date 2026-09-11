import path from 'node:path';
import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { DurationHistoryStore } from './duration-history.store';

/** Playwright reporter that records indexed duration history without changing test results. */
export default class DurationHistoryReporter implements Reporter {
  private readonly store = new DurationHistoryStore();

  onTestEnd(test: TestCase, result: TestResult): void {
    const relative = path.relative(process.cwd(), test.location.file).replace(/\\/g, '/');
    const key = `${relative}:${test.location.line}:${test.location.column}`;
    this.store.record(key, result.duration);
  }

  onEnd(): void { this.store.save(); }
}
