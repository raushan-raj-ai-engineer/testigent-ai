import fs from 'node:fs';
import path from 'node:path';
import { resolveApplicationScope } from '../core/config/application.scope';
import type { HealingDecision, LocatorDescriptor } from './healing.types';

interface CacheRecord {
  descriptor: LocatorDescriptor;
  confidence: number;
  updatedAt: string;
  validation?: 'semantic';
  verificationDescription?: string;
}

/**
 * Author: Raushan Raj
 * Business Use: Reuses semantically validated healing decisions before making another AI call.
 * How to use: Used internally by HealingOrchestrator; clear `.healing/<project>/locator-cache.json` to reset.
 * Benefit: Reduces repeated AI/MCP investigation while preventing stale/unverified locator guesses from becoming trusted cache entries.
 */
export class HealingCache {
  constructor(private readonly filePath = path.resolve('.healing', resolveApplicationScope(), 'locator-cache.json')) {}

  get(planId: string): CacheRecord | undefined {
    const all = this.load();
    const record = all[planId];
    // v1.2.2 intentionally refuses legacy cache records because older versions could cache
    // an actionable locator before its business post-condition was proven.
    if (!record || record.validation !== 'semantic') return undefined;
    return record;
  }

  set(planId: string, decision: HealingDecision, verificationDescription: string): void {
    const all = this.load();
    all[planId] = {
      descriptor: decision.descriptor,
      confidence: decision.confidence,
      updatedAt: new Date().toISOString(),
      validation: 'semantic',
      verificationDescription
    };
    this.persist(all);
  }

  delete(planId: string): void {
    const all = this.load();
    if (!(planId in all)) return;
    delete all[planId];
    this.persist(all);
  }

  private persist(all: Record<string, CacheRecord>): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(all, null, 2));
  }

  private load(): Record<string, CacheRecord> {
    if (!fs.existsSync(this.filePath)) return {};
    try { return JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as Record<string, CacheRecord>; }
    catch { return {}; }
  }
}
