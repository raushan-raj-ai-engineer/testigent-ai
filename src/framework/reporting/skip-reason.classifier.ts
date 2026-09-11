import type { BusinessTestResult, SkipCategory, SkipDisposition, SkipSummary } from '../analytics/report.types';

export interface SkipClassificationContext {
  annotationType?: string;
  tags?: string[];
  sourceFile?: string;
  title?: string;
}

const LABELS: Record<SkipCategory, string> = {
  OPTIONAL_DEMO_DISABLED: 'Optional demo disabled',
  DATABASE_NOT_CONFIGURED: 'Database not configured',
  HUMAN_REVIEW_PENDING: 'Human review pending',
  AUTH_NOT_CONFIGURED: 'Authentication not configured',
  DEPENDENCY_NOT_CONFIGURED: 'Dependency not configured',
  OTHER: 'Other / conditional skip'
};

const DISPOSITIONS: Record<SkipCategory, SkipDisposition> = {
  OPTIONAL_DEMO_DISABLED: 'NOT_APPLICABLE',
  DATABASE_NOT_CONFIGURED: 'NOT_APPLICABLE',
  HUMAN_REVIEW_PENDING: 'BLOCKED',
  AUTH_NOT_CONFIGURED: 'BLOCKED',
  DEPENDENCY_NOT_CONFIGURED: 'BLOCKED',
  OTHER: 'BLOCKED'
};

/**
 * Reusable framework function `classifySkipReason`.
 * Business Use: Centralizes shared TestigentAI behavior so project teams do not duplicate framework logic.
 * Benefit: Keeps behavior consistent, reviewable and reusable across organizations and applications.
 */
export function classifySkipReason(
  reason?: string,
  context: SkipClassificationContext = {}
): { category: SkipCategory; label: string } {
  const haystack = [
    reason ?? '',
    context.annotationType ?? '',
    ...(context.tags ?? []),
    context.sourceFile ?? '',
    context.title ?? ''
  ].join(' ').toLowerCase();

  let category: SkipCategory = 'OTHER';

  // Keep review gating ahead of DB tag detection because generated tests can
  // legitimately include @db while the real reason for non-execution is review.
  if (/review_required|generated-review|approve mappings|human review|fixme/.test(haystack)) {
    category = 'HUMAN_REVIEW_PENDING';
  } else if (/db_type|database|\bdb\b/.test(haystack)) {
    category = 'DATABASE_NOT_CONFIGURED';
  } else if (/storage.?state|authentication|auth required|login required|credential/.test(haystack)) {
    category = 'AUTH_NOT_CONFIGURED';
  } else if (/run through npm run test:|healing_demo|ai_healing_demo|demonstration|demo only/.test(haystack)) {
    category = 'OPTIONAL_DEMO_DISABLED';
  } else if (/not configured|configure .* before|dependency|connector|service unavailable by configuration/.test(haystack)) {
    category = 'DEPENDENCY_NOT_CONFIGURED';
  }

  return { category, label: LABELS[category] };
}

/**
 * Reusable framework function `buildSkipSummary`.
 * Business Use: Centralizes shared TestigentAI behavior so project teams do not duplicate framework logic.
 * Benefit: Keeps behavior consistent, reviewable and reusable across organizations and applications.
 */
export function buildSkipSummary(results: BusinessTestResult[]): SkipSummary {
  type Bucket = {
    label: string;
    testIds: Set<string>;
    titles: Set<string>;
    reasons: Set<string>;
  };

  const grouped = new Map<SkipCategory, Bucket>();

  for (const result of results) {
    if (result.status !== 'skipped') continue;

    const classification = result.skipCategory
      ? { category: result.skipCategory, label: LABELS[result.skipCategory] }
      : classifySkipReason(result.skipReason, {
          tags: result.tags,
          sourceFile: result.sourceFile,
          title: result.title
        });

    const bucket: Bucket = grouped.get(classification.category) ?? {
      label: classification.label,
      testIds: new Set<string>(),
      titles: new Set<string>(),
      reasons: new Set<string>()
    };

    // project + testId prevents duplicate counting across retries while preserving
    // independently executed browser/project instances.
    bucket.testIds.add(`${result.project}:${result.testId}`);
    bucket.titles.add(result.title);
    if (result.skipReason?.trim()) bucket.reasons.add(result.skipReason.trim());
    grouped.set(classification.category, bucket);
  }

  const order: SkipCategory[] = [
    'DATABASE_NOT_CONFIGURED',
    'HUMAN_REVIEW_PENDING',
    'OPTIONAL_DEMO_DISABLED',
    'AUTH_NOT_CONFIGURED',
    'DEPENDENCY_NOT_CONFIGURED',
    'OTHER'
  ];

  return {
    count: results.filter(result => result.status === 'skipped').length,
    categories: order
      .filter(category => grouped.has(category))
      .map(category => {
        const item = grouped.get(category)!;
        return {
          category,
          label: item.label,
          disposition: DISPOSITIONS[category],
          count: item.testIds.size,
          testTitles: [...item.titles].sort(),
          reasons: [...item.reasons].sort()
        };
      })
  };
}
