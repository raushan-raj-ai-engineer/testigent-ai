/**
 * Author: Raushan Raj
 * Business Use: Shared contracts for auditable locator healing, including scoped/component-aware recovery and semantic action validation.
 */
export type LocatorMatchPolicy = 'unique' | 'firstVisible';

type LocatorSelection = {
  /**
   * `unique` (default) requires exactly one visible match. `firstVisible` is an explicit
   * project-owned escape hatch for semantically equivalent duplicate controls. It must
   * be paired with a business post-condition for critical actions.
   */
  match?: LocatorMatchPolicy;
};

export type LocatorDescriptor =
  | ({ type: 'role'; role: 'button' | 'textbox' | 'link' | 'checkbox' | 'heading' | 'combobox' | 'dialog' | 'row' | 'tab' | 'menuitem'; name?: string; namePattern?: string; namePatternFlags?: string; exact?: boolean } & LocatorSelection)
  | ({ type: 'label'; value: string; exact?: boolean } & LocatorSelection)
  | ({ type: 'testId'; value: string } & LocatorSelection)
  | ({ type: 'placeholder'; value: string; exact?: boolean } & LocatorSelection)
  | ({ type: 'text'; value: string; exact?: boolean } & LocatorSelection)
  | ({ type: 'css'; value: string } & LocatorSelection);

export interface LocatorScopePlan {
  id: string;
  businessName: string;
  primary: LocatorDescriptor;
  fallbacks?: LocatorDescriptor[];
}

export interface LocatorPlan {
  id: string;
  businessName: string;
  primary: LocatorDescriptor;
  fallbacks?: LocatorDescriptor[];
  /** Optional stable container (dialog, modal, component, section) used to prevent page-wide ambiguity. */
  scope?: LocatorScopePlan;
}

export interface HealingDecision {
  descriptor: LocatorDescriptor;
  source: 'primary' | 'fallback' | 'cache' | 'ai';
  confidence: number;
  reason: string;
  aiProvider?: string;
  aiModel?: string;
  aiLatencyMs?: number;
}

/**
 * Validated is the only outcome that represents a successful self-heal.
 * Rejected attempts remain auditable but must never be cached or counted as healed.
 */
export type HealingOutcome = 'validated' | 'rejected' | 'suggested' | 'unverified';

export interface HealingVerificationEvidence {
  description?: string;
  passed?: boolean;
  durationMs?: number;
  error?: string;
}

export interface HealingPostCondition {
  /** Human-readable state transition expected after the action. */
  description: string;
  /** Return true only when the intended business/UI state has been reached. */
  verify: () => Promise<boolean>;
  timeoutMs?: number;
  intervalMs?: number;
}

export interface HealingActionOptions {
  postCondition?: HealingPostCondition;
  /**
   * Off by default because repeating an action can be unsafe (submit/delete/payment).
   * Enable only for actions known to be safe to retry, such as opening a modal.
   */
  retryOnPostConditionFailure?: boolean;
}
