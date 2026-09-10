import path from 'node:path';

/**
 * Author: Raushan Raj
 * Business Use: Keeps framework/unit/meta checks out of stakeholder quality metrics unless explicitly requested.
 * How to use: BusinessReporter calls shouldIncludeInBusinessReport() before recording a test result.
 * Benefit: Business totals represent product scenarios rather than framework self-tests, demos or reporting regression checks.
 */
export function shouldIncludeInBusinessReport(tags: string[], sourceFile?: string): boolean {
  if (process.env.BUSINESS_REPORT_INCLUDE_INTERNAL === 'true') return true;
  const normalizedTags = tags.map(tag => tag.toLowerCase());
  const normalizedPath = (sourceFile ? path.normalize(sourceFile) : '').replace(/\\/g, '/').toLowerCase();
  if (normalizedTags.includes('@framework') || normalizedTags.includes('@internal')) return false;
  if (normalizedPath.includes('/tests/framework/')) return false;
  return true;
}
