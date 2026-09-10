import fs from 'node:fs';
import path from 'node:path';
import type { ExecutionFacts, ReportHistoryPoint } from '../analytics/report.types';

/**
 * Author: Raushan Raj
 * Business Use: Maintains lightweight historical quality points for the dashboard trend chart.
 * How to use: Reporter appends local runs; CI should append only after shard reports are merged.
 * Benefit: Business sees whether quality is improving or degrading instead of viewing one isolated run.
 */
export class ReportHistoryStore {
  private readonly file: string;
  private readonly maxRuns: number;

  constructor(file = process.env.REPORT_HISTORY_FILE ?? `.report-history/${process.env.APP ?? 'demo'}/business-history.json`) {
    this.file = path.resolve(file);
    this.maxRuns = Math.max(5, Number(process.env.REPORT_HISTORY_MAX_RUNS ?? 30));
  }

  read(): ReportHistoryPoint[] {
    if (!fs.existsSync(this.file)) return [];
    try {
      const parsed = JSON.parse(fs.readFileSync(this.file, 'utf8')) as ReportHistoryPoint[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  append(facts: ExecutionFacts): ReportHistoryPoint[] {
    if (process.env.REPORT_HISTORY_ENABLED === 'false') return this.read();
    const current: ReportHistoryPoint = {
      runId: facts.runId,
      generatedAt: facts.generatedAt,
      environment: facts.environment,
      application: facts.application,
      total: facts.total,
      passed: facts.passed,
      failed: facts.failed,
      passRate: facts.passRate,
      flaky: facts.flakiness.flakyTests,
      healed: facts.healing.count
    };
    const previous = this.read().filter(point => point.runId !== current.runId);
    const next = [...previous, current].slice(-this.maxRuns);
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(next, null, 2));
    return next;
  }
}
