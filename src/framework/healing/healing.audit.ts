import fs from 'node:fs';
import path from 'node:path';
import type { HealingDecision, LocatorPlan } from './healing.types';
import { redact } from '../logging/redactor';
import { RunContext } from '../core/config/run.context';

/**
 * Author: Raushan Raj
 * Business Use: Creates an audit trail for every self-healing decision.
 * How to use: HealingOrchestrator records plan, decision, page URL and run identity automatically.
 * Benefit: Business/product defects are not hidden behind silent locator changes and reports can correlate healing to one execution.
 */
export class HealingAudit {
  constructor(private readonly filePath = path.resolve('reports', process.env.APP ?? 'demo', 'healing', 'healing-audit.jsonl')) {}

  record(plan: LocatorPlan, decision: HealingDecision, pageUrl: string, testId?: string): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.appendFileSync(
      this.filePath,
      `${JSON.stringify(redact({
        runId: RunContext.get().runId,
        timestamp: new Date().toISOString(),
        testId,
        pageUrl,
        planId: plan.id,
        businessName: plan.businessName,
        decision
      }))}\n`
    );
  }
}
