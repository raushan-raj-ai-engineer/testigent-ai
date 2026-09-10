/** Structured text extraction shared by remote requirement adapters. Author: Raushan Raj */
import type { ManualTestStep } from '../core/models.js';

export interface StructuredRequirementText {
  description?: string;
  preconditions: string[];
  acceptanceCriteria: string[];
  manualTestSteps: ManualTestStep[];
  expectedResults: string[];
  scenarioHints: string[];
}

const sectionAliases: Record<string, keyof Omit<StructuredRequirementText, 'description' | 'manualTestSteps'> | 'description' | 'steps'> = {
  'description': 'description', 'summary': 'description',
  'precondition': 'preconditions', 'preconditions': 'preconditions', 'prerequisites': 'preconditions',
  'acceptance': 'acceptanceCriteria', 'acceptance criteria': 'acceptanceCriteria', 'criteria': 'acceptanceCriteria', 'ac': 'acceptanceCriteria',
  'test steps': 'steps', 'manual test steps': 'steps', 'steps': 'steps',
  'expected result': 'expectedResults', 'expected results': 'expectedResults', 'outcomes': 'expectedResults',
  'scenario': 'scenarioHints', 'scenarios': 'scenarioHints', 'test scenario': 'scenarioHints', 'test scenarios': 'scenarioHints'
};

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter(value => {
    const key = value.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function cleanListLine(value: string): string {
  return value
    .replace(/^\s*[-*+]\s+/, '')
    .replace(/^\s*\d+[.)]\s+/, '')
    .replace(/^\s*\[[ xX]\]\s*/, '')
    .trim();
}

export function plainLines(value: string): string[] {
  return unique(value.split(/\r?\n/).map(cleanListLine).filter(Boolean));
}

export function parseManualStepLines(value: string): ManualTestStep[] {
  const lines = value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  return lines.map((line, index) => {
    const cleaned = cleanListLine(line);
    const [action, expectedResult] = cleaned.split(/\s*(?:=>|->|\|)\s*/, 2);
    return { order: index + 1, action: (action ?? '').trim(), ...(expectedResult?.trim() ? { expectedResult: expectedResult.trim() } : {}) };
  }).filter(step => Boolean(step.action));
}

function sectionName(raw: string): string | undefined {
  const cleaned = raw.replace(/^#{1,6}\s*/, '').replace(/:$/, '').trim().toLowerCase();
  return sectionAliases[cleaned] ? cleaned : undefined;
}

export function parseRequirementText(text: string): StructuredRequirementText {
  const sections = new Map<string, string[]>();
  let current = 'description';
  sections.set(current, []);

  for (const original of text.split(/\r?\n/)) {
    const line = original.trim();
    if (!line) continue;
    const heading = sectionName(line);
    if (heading) {
      current = heading;
      sections.set(current, sections.get(current) ?? []);
      continue;
    }
    sections.set(current, [...(sections.get(current) ?? []), line]);
  }

  const collect = (target: string): string[] => {
    const values: string[] = [];
    for (const [alias, mapped] of Object.entries(sectionAliases)) {
      if (mapped === target) values.push(...(sections.get(alias) ?? []));
    }
    return unique(values.map(cleanListLine).filter(Boolean));
  };

  let acceptanceCriteria = collect('acceptanceCriteria');
  if (!acceptanceCriteria.length) {
    acceptanceCriteria = unique(text.split(/\r?\n/)
      .map(cleanListLine)
      .filter(line => /^(?:given\b|when\b|then\b|.*\b(?:should|must)\b)/i.test(line)));
  }

  const stepText = Object.entries(sectionAliases)
    .filter(([, mapped]) => mapped === 'steps')
    .flatMap(([alias]) => sections.get(alias) ?? [])
    .join('\n');

  const descriptionLines = sections.get('description') ?? [];
  return {
    description: descriptionLines.length ? descriptionLines.map(cleanListLine).join(' ') : undefined,
    preconditions: collect('preconditions'),
    acceptanceCriteria,
    manualTestSteps: parseManualStepLines(stepText),
    expectedResults: collect('expectedResults'),
    scenarioHints: collect('scenarioHints')
  };
}

export function htmlToPlainText(value: string): string {
  return value
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(?:p|div|li|tr|h[1-6])\s*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function adfToPlainText(node: unknown): string {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(adfToPlainText).join('');
  if (typeof node !== 'object') return String(node);

  const record = node as Record<string, unknown>;
  const type = String(record.type ?? '');
  if (type === 'text') return String(record.text ?? '');
  if (type === 'hardBreak') return '\n';

  const content = adfToPlainText(record.content);
  if (type === 'listItem') return `- ${content.trim()}\n`;
  if (['paragraph', 'heading', 'blockquote', 'tableRow', 'tableCell', 'panel'].includes(type)) return `${content.trim()}\n`;
  if (['bulletList', 'orderedList', 'table', 'doc'].includes(type)) return `${content}\n`;
  return content;
}
