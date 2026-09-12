import type { Locator, Page } from '@playwright/test';
import type { AiGateway } from '../ai/ai.gateway.js';
import type { EnterpriseLogger } from '../logging/enterprise.logger.js';
import { HealingAudit } from './healing.audit.js';
import { HealingCache } from './healing.cache.js';
import type {
  HealingActionOptions,
  HealingDecision,
  HealingPostCondition,
  HealingVerificationEvidence,
  LocatorDescriptor,
  LocatorPlan,
  LocatorScopePlan
} from './healing.types.js';
import { resolveLocator, type LocatorRoot } from './locator.resolver.js';

interface ResolvedCandidate {
  locator: Locator;
  decision: HealingDecision;
}

type AiGatewayFactory = () => AiGateway | undefined;

/**
 * Author: Raushan Raj
 * Business Use: Guarded runtime locator recovery for UI changes while preserving functional assertions.
 * How to use: Page Objects call healer.click/fill/fillAndPress with semantic LocatorPlan(s); critical clicks should provide a post-condition.
 * Benefit: Deterministic first, optional AI last, semantically validated before caching, scoped to the correct component/modal and fully audited.
 */
export class HealingOrchestrator {
  private readonly audit = new HealingAudit();
  private readonly cache = new HealingCache();
  private aiResolved = false;
  private resolvedAi?: AiGateway;

  constructor(
    private readonly page: Page,
    private readonly logger: EnterpriseLogger,
    private readonly ai?: AiGateway | AiGatewayFactory,
    private readonly testId?: string
  ) {}

  async click(plan: LocatorPlan, options: HealingActionOptions = {}): Promise<void> {
    await this.clickWithin(this.page, plan, options);
  }

  async clickWithin(root: LocatorRoot, plan: LocatorPlan, options: HealingActionOptions = {}): Promise<void> {
    await this.performAction(root, plan, locator => locator.click(), options);
  }

  async fill(plan: LocatorPlan, value: string, options: HealingActionOptions = {}): Promise<void> {
    await this.fillWithin(this.page, plan, value, options);
  }

  async fillWithin(root: LocatorRoot, plan: LocatorPlan, value: string, options: HealingActionOptions = {}): Promise<void> {
    await this.performAction(root, plan, locator => locator.fill(value), options);
  }

  async fillAndPress(plan: LocatorPlan, value: string, key: string, options: HealingActionOptions = {}): Promise<void> {
    await this.performAction(this.page, plan, async locator => {
      await locator.fill(value);
      await locator.press(key);
    }, options);
  }

  /**
   * Locator-only resolution is intentionally not promoted into cache because visibility/uniqueness
   * does not prove that the locator represents the intended business element.
   */
  async resolve(plan: LocatorPlan): Promise<Locator> {
    return this.resolveWithin(this.page, plan);
  }

  async resolveWithin(root: LocatorRoot, plan: LocatorPlan, skipPrimary = false): Promise<Locator> {
    const candidate = await this.resolveCandidate(root, plan, { skipPrimary });
    if (candidate.decision.source !== 'primary') {
      this.audit.record(
        plan,
        candidate.decision,
        this.page.url(),
        this.testId,
        'unverified',
        { description: 'Locator-only resolution; no business post-condition supplied.' }
      );
      this.logger.warn('SELF_HEALING_UNVERIFIED_RESOLUTION', { planId: plan.id, decision: candidate.decision });
    }
    return candidate.locator;
  }

  private async performAction(
    root: LocatorRoot,
    plan: LocatorPlan,
    action: (locator: Locator) => Promise<void>,
    options: HealingActionOptions
  ): Promise<void> {
    const excluded = new Set<string>();
    const mode = this.healingMode();

    while (true) {
      const candidate = await this.resolveCandidate(root, plan, { excluded });
      const source = candidate.decision.source;

      try {
        await action(candidate.locator);
      } catch (error) {
        this.logger.warn('SELF_HEALING_ACTIONABILITY_FAILURE', {
          planId: plan.id,
          source,
          error: String(error)
        });

        if (source !== 'primary') {
          this.audit.record(
            plan,
            candidate.decision,
            this.page.url(),
            this.testId,
            'rejected',
            { passed: false, error: this.errorText(error), description: 'Locator action could not be completed.' }
          );
          if (source === 'cache') this.cache.delete(plan.id);
        }

        if (mode === 'off') throw error;
        excluded.add(this.descriptorKey(candidate.decision.descriptor));
        continue;
      }

      if (!options.postCondition) {
        if (source !== 'primary') {
          this.audit.record(
            plan,
            candidate.decision,
            this.page.url(),
            this.testId,
            'unverified',
            { description: 'Action completed but no semantic post-condition was supplied.' }
          );
          this.logger.warn('SELF_HEALING_ACTION_UNVERIFIED', {
            planId: plan.id,
            source,
            reason: 'No semantic post-condition; recovery will not be cached or counted as validated healing.'
          });
        }
        return;
      }

      const verification = await this.verifyPostCondition(options.postCondition);
      if (verification.passed) {
        if (source !== 'primary') this.acceptRecovery(plan, candidate.decision, options.postCondition, verification);
        return;
      }

      if (source !== 'primary') {
        this.audit.record(plan, candidate.decision, this.page.url(), this.testId, 'rejected', verification);
        if (source === 'cache') this.cache.delete(plan.id);
        this.logger.warn('SELF_HEALING_POSTCONDITION_REJECTED', {
          planId: plan.id,
          source,
          verification
        });
      } else {
        this.logger.warn('PRIMARY_ACTION_POSTCONDITION_FAILED', { planId: plan.id, verification });
      }

      const canRetry = options.retryOnPostConditionFailure === true
        && mode !== 'off'
        && (mode === 'runtime' || source === 'primary' || source === 'fallback');
      if (!canRetry) {
        throw new Error(
          `Post-condition failed for ${plan.businessName}: ${options.postCondition.description}` +
          (verification.error ? ` (${verification.error})` : '')
        );
      }

      excluded.add(this.descriptorKey(candidate.decision.descriptor));
    }
  }

  private acceptRecovery(
    plan: LocatorPlan,
    decision: HealingDecision,
    postCondition: HealingPostCondition,
    verification: HealingVerificationEvidence
  ): void {
    this.audit.record(plan, decision, this.page.url(), this.testId, 'validated', verification);

    // Deterministic fallbacks are already source-controlled. Cache only dynamic AI recoveries;
    // cache hits are already semantically validated records from a prior execution.
    if (decision.source === 'ai') this.cache.set(plan.id, decision, postCondition.description);

    this.logger.warn('SELF_HEALING_VALIDATED', {
      planId: plan.id,
      source: decision.source,
      verification: postCondition.description,
      cached: decision.source === 'ai'
    });
  }

  private async resolveCandidate(
    root: LocatorRoot,
    plan: LocatorPlan,
    options: { skipPrimary?: boolean; excluded?: Set<string> } = {}
  ): Promise<ResolvedCandidate> {
    const excluded = options.excluded ?? new Set<string>();
    const scopedRoot = plan.scope ? await this.resolveScope(root, plan.scope) : root;

    if (!options.skipPrimary && !excluded.has(this.descriptorKey(plan.primary))) {
      const primary = await this.usableLocator(scopedRoot, plan.primary);
      if (primary) {
        return {
          locator: primary,
          decision: {
            descriptor: plan.primary,
            source: 'primary',
            confidence: 1,
            reason: plan.primary.match === 'firstVisible'
              ? 'Configured primary locator resolved the first visible equivalent match by explicit project policy.'
              : 'Configured primary locator is the unique visible match.'
          }
        };
      }
    }

    const mode = this.healingMode();
    if (mode === 'off') throw new Error(`Primary locator failed for ${plan.businessName}`);

    // Healing priority is intentionally deterministic-first:
    // primary -> declared fallbacks -> semantically validated cache -> AI provider chain.
    for (const fallback of plan.fallbacks ?? []) {
      if (excluded.has(this.descriptorKey(fallback))) continue;
      const locator = await this.usableLocator(scopedRoot, fallback);
      if (locator) {
        const decision: HealingDecision = {
          descriptor: fallback,
          source: 'fallback',
          confidence: 0.98,
          reason: fallback.match === 'firstVisible'
            ? 'Configured deterministic fallback resolved the first visible equivalent match by explicit project policy.'
            : 'Configured deterministic fallback is the unique visible match.'
        };
        return this.useCandidateOrSuggest(plan, locator, decision, mode);
      }
    }

    const cached = this.cache.get(plan.id);
    if (
      cached &&
      this.isAllowedDescriptor(cached.descriptor) &&
      !excluded.has(this.descriptorKey(cached.descriptor)) &&
      !this.sameDescriptor(cached.descriptor, plan.primary)
    ) {
      const locator = await this.usableLocator(scopedRoot, cached.descriptor);
      if (locator) {
        const decision: HealingDecision = {
          descriptor: cached.descriptor,
          source: 'cache',
          confidence: cached.confidence,
          reason: 'Previously semantically validated locator recovery.'
        };
        return this.useCandidateOrSuggest(plan, locator, decision, mode);
      }
      this.cache.delete(plan.id);
      this.logger.warn('SELF_HEALING_CACHE_EVICTED', {
        planId: plan.id,
        reason: 'Cached locator is no longer safely resolvable under its visible-match policy.'
      });
    }

    const aiDecision = await this.askAi(plan, scopedRoot);
    if (aiDecision && !excluded.has(this.descriptorKey(aiDecision.descriptor))) {
      const minConfidence = Number(process.env.HEALING_MIN_CONFIDENCE ?? 0.95);
      if (aiDecision.confidence >= minConfidence) {
        const locator = await this.usableLocator(scopedRoot, aiDecision.descriptor);
        if (locator) return this.useCandidateOrSuggest(plan, locator, aiDecision, mode);
      }
    }

    const visibleControls = await this.visibleInteractiveSummary(scopedRoot);
    this.logger.warn('LOCATOR_RESOLUTION_FAILED', {
      planId: plan.id,
      businessName: plan.businessName,
      url: this.page.url(),
      visibleControls
    });
    const context = visibleControls.length ? ` Visible controls: ${visibleControls.join(' | ')}` : '';
    throw new Error(`Unable to safely resolve locator for ${plan.businessName}.${context}`);
  }

  private useCandidateOrSuggest(
    plan: LocatorPlan,
    locator: Locator,
    decision: HealingDecision,
    mode: string
  ): ResolvedCandidate {
    // Source-controlled deterministic fallbacks are reviewed project code, not dynamic healing.
    // They remain usable in suggest mode so a fresh checkout is resilient without enabling AI.
    if (decision.source === 'fallback' || mode === 'runtime') return { locator, decision };

    this.audit.record(
      plan,
      decision,
      this.page.url(),
      this.testId,
      'suggested',
      { description: 'Candidate found but runtime healing is disabled in suggest mode.' }
    );
    throw new Error(`Healing suggestion found for ${plan.businessName}; HEALING_MODE=suggest prevents automatic use.`);
  }

  private async resolveScope(root: LocatorRoot, scope: LocatorScopePlan): Promise<Locator> {
    const primary = await this.usableLocator(root, scope.primary);
    if (primary) return primary;

    for (const fallback of scope.fallbacks ?? []) {
      const locator = await this.usableLocator(root, fallback);
      if (locator) return locator;
    }

    throw new Error(`Unable to safely resolve UI scope for ${scope.businessName}`);
  }

  /**
   * Playwright locators can legitimately match both hidden template/modal elements and the
   * visible control the user can act on. Resolve cardinality against visible elements, not
   * raw DOM count. Ambiguity still fails closed unless the project explicitly declares that
   * duplicate visible controls are semantically equivalent via `match: 'firstVisible'`.
   */
  private async usableLocator(root: LocatorRoot, descriptor: LocatorDescriptor): Promise<Locator | undefined> {
    try {
      const visible = resolveLocator(root, descriptor).visible();
      const count = await visible.count();
      if (count < 1) return undefined;

      if ((descriptor.match ?? 'unique') === 'unique' && count !== 1) {
        this.logger.warn('LOCATOR_AMBIGUOUS_VISIBLE_MATCHES', {
          descriptor,
          visibleCount: count
        });
        return undefined;
      }

      const selected = descriptor.match === 'firstVisible' ? visible.first() : visible;
      await selected.waitFor({ state: 'visible', timeout: 1_500 });
      return selected;
    } catch {
      return undefined;
    }
  }

  private async verifyPostCondition(postCondition: HealingPostCondition): Promise<HealingVerificationEvidence> {
    const started = Date.now();
    const timeoutMs = this.positiveInteger(String(postCondition.timeoutMs ?? process.env.HEALING_POSTCONDITION_TIMEOUT_MS ?? ''), 5_000);
    const intervalMs = this.positiveInteger(String(postCondition.intervalMs ?? process.env.HEALING_POSTCONDITION_INTERVAL_MS ?? ''), 100);
    let lastError: string | undefined;

    while (Date.now() - started <= timeoutMs) {
      try {
        if (await postCondition.verify()) {
          return { description: postCondition.description, passed: true, durationMs: Date.now() - started };
        }
      } catch (error) {
        lastError = this.errorText(error);
      }
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    return {
      description: postCondition.description,
      passed: false,
      durationMs: Date.now() - started,
      error: lastError
    };
  }

  private async askAi(plan: LocatorPlan, root: LocatorRoot): Promise<HealingDecision | undefined> {
    if ((process.env.HEALING_AI_ENABLED ?? 'false').toLowerCase() !== 'true') return undefined;
    const ai = this.aiGateway();
    if (!ai) return undefined;

    const snapshot = await (root === this.page ? this.page.locator('body') : root as Locator).ariaSnapshot();
    const maxSnapshotChars = this.positiveInteger(process.env.AI_HEALING_SNAPSHOT_MAX_CHARS, 6_000);

    const response = await ai.proposeLocator({
      planId: plan.id,
      businessName: plan.businessName,
      accessibilitySnapshot: snapshot.slice(0, maxSnapshotChars),
      allowedDescriptorTypes: ['role', 'label', 'testId', 'placeholder', 'text']
    });

    if (!response || !this.isAllowedDescriptor(response.descriptor)) return undefined;

    const decision: HealingDecision = {
      descriptor: response.descriptor,
      source: 'ai',
      confidence: response.confidence,
      reason: response.reason,
      aiProvider: response.provider,
      aiModel: response.model,
      aiLatencyMs: response.latencyMs
    };
    this.logger.warn('SELF_HEALING_AI_PROPOSAL', { planId: plan.id, aiDecision: decision });
    return decision;
  }

  /**
   * AI is resolved only after primary, deterministic fallbacks and validated cache have failed.
   * This keeps ordinary UI execution independent from AI provider configuration and avoids
   * provider/network startup cost when deterministic automation is healthy.
   */
  private aiGateway(): AiGateway | undefined {
    if (!this.ai) return undefined;
    if (typeof this.ai !== 'function') return this.ai;
    if (!this.aiResolved) {
      this.resolvedAi = this.ai();
      this.aiResolved = true;
    }
    return this.resolvedAi;
  }

  private healingMode(): string {
    return process.env.HEALING_MODE ?? 'suggest';
  }

  private descriptorKey(descriptor: LocatorDescriptor): string {
    return JSON.stringify(descriptor);
  }

  private sameDescriptor(a: LocatorDescriptor, b: LocatorDescriptor): boolean {
    return this.descriptorKey(a) === this.descriptorKey(b);
  }

  private isAllowedDescriptor(value: unknown): value is LocatorDescriptor {
    if (!value || typeof value !== 'object') return false;
    const d = value as Record<string, unknown>;
    if (d.type === 'role') {
      if (typeof d.role !== 'string') return false;
      if (d.name !== undefined && typeof d.name !== 'string') return false;
      if (d.namePattern !== undefined && typeof d.namePattern !== 'string') return false;
      if (d.namePatternFlags !== undefined && typeof d.namePatternFlags !== 'string') return false;
      if (typeof d.namePattern === 'string') {
        try { new RegExp(d.namePattern, typeof d.namePatternFlags === 'string' ? d.namePatternFlags : 'i'); }
        catch { return false; }
      }
      return true;
    }
    if (['label', 'testId', 'placeholder', 'text'].includes(String(d.type))) return typeof d.value === 'string' && d.value.length > 0;
    return false;
  }

  private async visibleInteractiveSummary(root: LocatorRoot): Promise<string[]> {
    try {
      const controls = root
        .locator('button, a, [role="button"], [role="link"], [role="tab"], [role="menuitem"]')
        .visible();
      const count = Math.min(await controls.count(), 16);
      const summaries: string[] = [];
      for (let index = 0; index < count; index += 1) {
        const item = controls.nth(index);
        const summary = await item.evaluate((element) => {
          const html = element as HTMLElement;
          const text = (html.innerText || html.textContent || '').replace(/\s+/g, ' ').trim();
          const label = html.getAttribute('aria-label') || html.getAttribute('title') || '';
          const id = html.id ? `#${html.id}` : '';
          const testId = html.getAttribute('data-testid') ? `[data-testid=${html.getAttribute('data-testid')}]` : '';
          const role = html.getAttribute('role') || html.tagName.toLowerCase();
          const name = label || text || id || testId || '(unnamed)';
          return `${role}:${name}`;
        }).catch(() => '');
        if (summary) summaries.push(summary.slice(0, 120));
      }
      return summaries;
    } catch {
      return [];
    }
  }

  private positiveInteger(raw: string | undefined, fallback: number): number {
    const value = Number(raw ?? fallback);
    return Number.isInteger(value) && value > 0 ? value : fallback;
  }

  private errorText(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
