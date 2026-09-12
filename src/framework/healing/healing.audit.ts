import fs from 'node:fs';
import path from 'node:path';
import type { HealingDecision, HealingOutcome, HealingVerificationEvidence, LocatorPlan } from './healing.types';
import { redact } from '../logging/redactor';
import { RunContext } from '../core/config/run.context';
import { ProjectPaths } from '../core/config/project.paths';

/**
 * Author: Raushan Raj
 * Business Use: Creates an audit trail for every healing proposal/attempt and whether semantic validation accepted it.
 * Benefit: Reports can distinguish a genuine self-heal from a rejected locator guess; assertions are never hidden behind a false healing success.
 */
export class HealingAudit {
  constructor(private readonly filePath = path.join(ProjectPaths.reports(), 'healing', 'healing-audit.jsonl')) {}

  record(
    plan: LocatorPlan,
    decision: HealingDecision,
    pageUrl: string,
    testId?: string,
    outcome: HealingOutcome = 'validated',
    verification?: HealingVerificationEvidence
  ): void {
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
        outcome,
        verification,
        decision
      }))}\n`
    );
  }
}
