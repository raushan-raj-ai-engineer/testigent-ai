/**
 * Author: Raushan Raj
 * Business Use: Shared contracts for auditable locator healing, including scoped/component-aware recovery.
 */
export type LocatorDescriptor =
  | { type: 'role'; role: 'button' | 'textbox' | 'link' | 'checkbox' | 'heading' | 'combobox' | 'dialog' | 'row'; name?: string; exact?: boolean }
  | { type: 'label'; value: string; exact?: boolean }
  | { type: 'testId'; value: string }
  | { type: 'placeholder'; value: string; exact?: boolean }
  | { type: 'text'; value: string; exact?: boolean }
  | { type: 'css'; value: string };

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
