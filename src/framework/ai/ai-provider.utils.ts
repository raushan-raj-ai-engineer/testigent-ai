import type { AiHealingRequest, AiHealingResponse } from './ai.types';
import type { LocatorDescriptor } from '../healing/healing.types';

/**
 * Author: Raushan Raj
 * Business Use: Shared schema/prompt/validation logic used by every cloud and local LLM provider.
 * How to use: Provider adapters call buildHealingPrompt(), HEALING_OUTPUT_SCHEMA and parseHealingJson().
 * Benefit: All LLMs obey one healing contract and provider-specific code stays small and replaceable.
 */
export const HEALING_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    descriptor: {
      type: 'object',
      properties: {
        type: { enum: ['role', 'label', 'testId', 'placeholder', 'text'] },
        role: { enum: ['', 'button', 'textbox', 'link', 'checkbox', 'heading', 'combobox'] },
        name: { type: 'string' },
        value: { type: 'string' }
      },
      required: ['type', 'role', 'name', 'value'],
      additionalProperties: false
    },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    reason: { type: 'string' }
  },
  required: ['descriptor', 'confidence', 'reason'],
  additionalProperties: false
} as const;

export function buildHealingPrompt(request: AiHealingRequest): { system: string; user: string } {
  const system = [
    'You are a guarded Playwright locator recovery assistant.',
    'Return one locator candidate only. Never change assertions, API expectations, database expectations, or business outcomes.',
    `Allowed descriptor types: ${request.allowedDescriptorTypes.join(', ')}.`,
    'Prefer role + accessible name, then label, testId, placeholder, then exact visible text.',
    'The candidate must be directly supported by the supplied accessibility snapshot.',
    'For descriptor.type=role set role and name; set value to an empty string.',
    'For all other descriptor types set value; set role and name to empty strings.',
    'Use confidence >= 0.98 only for an explicit, unambiguous semantic match. Lower confidence when uncertain.'
  ].join(' ');

  const user = [
    `Plan ID: ${request.planId}`,
    `Business element: ${request.businessName}`,
    'Accessibility snapshot:',
    request.accessibilitySnapshot
  ].join('\n\n');

  return { system, user };
}

export function buildSummaryPrompt(payload: unknown): { system: string; user: string } {
  return {
    system: [
      'You are an enterprise test automation report analyst.',
      'The supplied JSON is a deterministic source-of-truth facts object created by code.',
      'Never calculate new totals, percentages, failure counts, healing counts, retry counts or severities.',
      'Never contradict numeric facts and never invent healing, outages, product defects, business impact or root causes.',
      'When facts.healing.count is zero, explicitly state that no self-healing was used.',
      'When facts.failureClusters is empty, explicitly state that there are no final failure clusters.',
      'Use observed evidence first. Any interpretation must be labelled Likely interpretation, not observed fact.',
      'Return four concise sections: Observed facts, Likely interpretation, Business relevance, Recommended next actions.',
      'Do not expose secrets, tokens, passwords, PII or raw stack traces.'
    ].join(' '),
    user: JSON.stringify({ facts: payload })
  };
}

export function parseHealingJson(
  content: string | undefined,
  metadata: { provider: string; model?: string; latencyMs?: number }
): AiHealingResponse | undefined {
  if (!content) return undefined;
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    if (typeof parsed.confidence !== 'number' || parsed.confidence < 0 || parsed.confidence > 1) return undefined;
    if (typeof parsed.reason !== 'string' || !parsed.reason.trim()) return undefined;
    const raw = parsed.descriptor;
    if (!raw || typeof raw !== 'object') return undefined;
    const d = raw as Record<string, unknown>;
    const type = String(d.type);
    let descriptor: LocatorDescriptor | undefined;
    if (type === 'role') {
      const role = String(d.role) as Extract<LocatorDescriptor, { type: 'role' }>['role'];
      const allowedRoles = ['button', 'textbox', 'link', 'checkbox', 'heading', 'combobox'];
      if (!allowedRoles.includes(role)) return undefined;
      const name = typeof d.name === 'string' && d.name.trim() ? d.name : undefined;
      descriptor = { type: 'role', role, ...(name ? { name } : {}) };
    } else if (['label', 'testId', 'placeholder', 'text'].includes(type)) {
      if (typeof d.value !== 'string' || !d.value.trim()) return undefined;
      descriptor = { type, value: d.value } as LocatorDescriptor;
    }
    if (!descriptor) return undefined;
    return {
      descriptor,
      confidence: parsed.confidence,
      reason: parsed.reason,
      ...metadata
    };
  } catch {
    return undefined;
  }
}

export function extractOpenAiResponseText(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const record = body as Record<string, unknown>;
  if (typeof record.output_text === 'string' && record.output_text.trim()) return record.output_text.trim();
  const output = Array.isArray(record.output) ? record.output : [];
  for (const item of output) {
    if (!item || typeof item !== 'object') continue;
    const content = Array.isArray((item as Record<string, unknown>).content) ? (item as Record<string, unknown>).content as unknown[] : [];
    for (const part of content) {
      if (!part || typeof part !== 'object') continue;
      const p = part as Record<string, unknown>;
      if ((p.type === 'output_text' || p.type === 'text') && typeof p.text === 'string' && p.text.trim()) return p.text.trim();
    }
  }
  return undefined;
}

export async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
