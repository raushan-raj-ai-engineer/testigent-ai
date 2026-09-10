import fs from 'node:fs';
import path from 'node:path';
import type { HealingDecision, LocatorDescriptor } from './healing.types';

interface CacheRecord { descriptor: LocatorDescriptor; confidence: number; updatedAt: string; }

/**
 * Author: Raushan Raj
 * Business Use: Reuses previously validated healing decisions before making another AI call.
 * How to use: Used internally by HealingOrchestrator; clear `.healing/<project>/locator-cache.json` to reset.
 * Benefit: Reduces repeated AI/MCP investigation and therefore token/cost overhead.
 */
export class HealingCache {
  constructor(private readonly filePath = path.resolve('.healing', process.env.APP ?? 'demo', 'locator-cache.json')) {}

  get(planId: string): CacheRecord | undefined {
    const all = this.load();
    return all[planId];
  }

  set(planId: string, decision: HealingDecision): void {
    const all = this.load();
    all[planId] = { descriptor: decision.descriptor, confidence: decision.confidence, updatedAt: new Date().toISOString() };
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(all, null, 2));
  }

  delete(planId: string): void {
    const all = this.load();
    if (!(planId in all)) return;
    delete all[planId];
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(all, null, 2));
  }

  private load(): Record<string, CacheRecord> {
    if (!fs.existsSync(this.filePath)) return {};
    try { return JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as Record<string, CacheRecord>; }
    catch { return {}; }
  }
}
