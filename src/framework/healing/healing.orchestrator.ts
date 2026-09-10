import type { Locator, Page } from '@playwright/test';
import type { AiGateway } from '../ai/ai.gateway.js';
import type { EnterpriseLogger } from '../logging/enterprise.logger.js';
import { HealingAudit } from './healing.audit.js';
import { HealingCache } from './healing.cache.js';
import type { HealingDecision, LocatorDescriptor, LocatorPlan, LocatorScopePlan } from './healing.types.js';
import { resolveLocator, type LocatorRoot } from './locator.resolver.js';

/**
 * Author: Raushan Raj
 * Business Use: Guarded runtime locator recovery for UI changes while preserving functional assertions.
 * How to use: Page Objects call healer.click/fill/fillAndPress with semantic LocatorPlan(s).
 * Benefit: Deterministic first, optional AI last, scoped to the correct component/modal and fully audited.
 */
export class HealingOrchestrator {
  private readonly audit = new HealingAudit();
  private readonly cache = new HealingCache();

  constructor(
    private readonly page: Page,
    private readonly logger: EnterpriseLogger,
    private readonly ai?: AiGateway,
    private readonly testId?: string
  ) {}

  async click(plan: LocatorPlan): Promise<void> {
    await this.clickWithin(this.page, plan);
  }

  async clickWithin(root: LocatorRoot, plan: LocatorPlan): Promise<void> {
    const locator = await this.resolveWithin(root, plan);
    try {
      await locator.click();
    } catch (error) {
      const mode = process.env.HEALING_MODE ?? 'suggest';
      this.logger.warn('SELF_HEALING_ACTIONABILITY_FAILURE', { planId: plan.id, error: String(error) });
      if (mode === 'off') throw error;
      const recovered = await this.resolveWithin(root, plan, true);
      await recovered.click();
    }
  }

  async fill(plan: LocatorPlan, value: string): Promise<void> {
    await this.fillWithin(this.page, plan, value);
  }

  async fillWithin(root: LocatorRoot, plan: LocatorPlan, value: string): Promise<void> {
    const locator = await this.resolveWithin(root, plan);
    await locator.fill(value);
  }

  async fillAndPress(plan: LocatorPlan, value: string, key: string): Promise<void> {
    const locator = await this.resolve(plan);
    await locator.fill(value);
    await locator.press(key);
  }

  async resolve(plan: LocatorPlan): Promise<Locator> {
    return this.resolveWithin(this.page, plan);
  }

  async resolveWithin(root: LocatorRoot, plan: LocatorPlan, skipPrimary = false): Promise<Locator> {
    const scopedRoot = plan.scope ? await this.resolveScope(root, plan.scope) : root;
    if (!skipPrimary) {
      const primary = resolveLocator(scopedRoot, plan.primary);
      if (await this.isUsable(primary)) return primary;
    }

    const mode = process.env.HEALING_MODE ?? 'suggest';
    if (mode === 'off') throw new Error(`Primary locator failed for ${plan.businessName}`);

    // Healing priority is intentionally deterministic-first:
    // primary -> declared fallbacks -> validated cache -> AI provider chain.
    for (const fallback of plan.fallbacks ?? []) {
      if (skipPrimary && this.sameDescriptor(fallback, plan.primary)) continue;
      const locator = resolveLocator(scopedRoot, fallback);
      if (await this.isUsable(locator)) {
        const decision: HealingDecision = { descriptor: fallback, source: 'fallback', confidence: 0.98, reason: 'Configured deterministic fallback is visible and unique.' };
        this.audit.record(plan, decision, this.page.url(), this.testId);
        this.logger.warn('SELF_HEALING_FALLBACK_FOUND', { planId: plan.id, decision });
        if (mode === 'runtime') { this.cache.set(plan.id, decision); return locator; }
        throw new Error(`Healing suggestion found for ${plan.businessName}; HEALING_MODE=suggest prevents automatic use.`);
      }
    }

    const cached = this.cache.get(plan.id);
    if (cached && this.isAllowedDescriptor(cached.descriptor) && !this.sameDescriptor(cached.descriptor, plan.primary)) {
      const locator = resolveLocator(scopedRoot, cached.descriptor);
      if (await this.isUsable(locator)) {
        const decision: HealingDecision = { descriptor: cached.descriptor, source: 'cache', confidence: cached.confidence, reason: 'Previously validated locator recovery.' };
        this.audit.record(plan, decision, this.page.url(), this.testId);
        this.logger.warn('SELF_HEALING_CACHE_HIT', { planId: plan.id, decision });
        if (mode === 'runtime') return locator;
        throw new Error(`Cached healing suggestion exists for ${plan.businessName}; HEALING_MODE=suggest prevents automatic use.`);
      }
      this.cache.delete(plan.id);
      this.logger.warn('SELF_HEALING_CACHE_EVICTED', { planId: plan.id, reason: 'Cached locator is no longer visible and unique.' });
    }

    const aiDecision = await this.askAi(plan, scopedRoot);
    if (aiDecision) {
      this.audit.record(plan, aiDecision, this.page.url(), this.testId);
      this.logger.warn('SELF_HEALING_AI_PROPOSAL', { planId: plan.id, aiDecision });
      const minConfidence = Number(process.env.HEALING_MIN_CONFIDENCE ?? 0.95);
      if (mode === 'runtime' && aiDecision.confidence >= minConfidence) {
        const locator = resolveLocator(scopedRoot, aiDecision.descriptor);
        if (await this.isUsable(locator)) { this.cache.set(plan.id, aiDecision); return locator; }
      }
    }

    throw new Error(`Unable to safely resolve locator for ${plan.businessName}`);
  }

  private async resolveScope(root: LocatorRoot, scope: LocatorScopePlan): Promise<Locator> {
    const primary = resolveLocator(root, scope.primary);
    if (await this.isUsable(primary)) return primary;
    for (const fallback of scope.fallbacks ?? []) {
      const locator = resolveLocator(root, fallback);
      if (await this.isUsable(locator)) return locator;
    }
    throw new Error(`Unable to safely resolve UI scope for ${scope.businessName}`);
  }

  private async isUsable(locator: Locator): Promise<boolean> {
    try {
      if (await locator.count() !== 1) return false;
      await locator.waitFor({ state: 'visible', timeout: 1_500 });
      return true;
    } catch { return false; }
  }

  private async askAi(plan: LocatorPlan, root: LocatorRoot): Promise<HealingDecision | undefined> {
    if (!this.ai || (process.env.HEALING_AI_ENABLED ?? 'false').toLowerCase() !== 'true') return undefined;
    const snapshot = await (root === this.page ? this.page.locator('body') : root as Locator).ariaSnapshot();
    const response = await this.ai.proposeLocator({
      planId: plan.id,
      businessName: plan.businessName,
      accessibilitySnapshot: snapshot.slice(0, 12_000),
      allowedDescriptorTypes: ['role', 'label', 'testId', 'placeholder', 'text']
    });
    if (!response || !this.isAllowedDescriptor(response.descriptor)) return undefined;
    return {
      descriptor: response.descriptor,
      source: 'ai',
      confidence: response.confidence,
      reason: response.reason,
      aiProvider: response.provider,
      aiModel: response.model,
      aiLatencyMs: response.latencyMs
    };
  }

  private sameDescriptor(a: LocatorDescriptor, b: LocatorDescriptor): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  private isAllowedDescriptor(value: unknown): value is LocatorDescriptor {
    if (!value || typeof value !== 'object') return false;
    const d = value as Record<string, unknown>;
    if (d.type === 'role') return typeof d.role === 'string' && (d.name === undefined || typeof d.name === 'string');
    if (['label', 'testId', 'placeholder', 'text'].includes(String(d.type))) return typeof d.value === 'string' && d.value.length > 0;
    return false;
  }
}
