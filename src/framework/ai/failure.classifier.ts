export type FailureCategory = 'PRODUCT_DEFECT' | 'TEST_DEFECT' | 'DATA_DEFECT' | 'ENVIRONMENT' | 'DEPENDENCY' | 'UNKNOWN';

/**
 * Author: Raushan Raj
 * Business Use: Provides a deterministic first-pass failure category before optional AI RCA.
 * How to use: Business reporter classifies short errors; AI may enrich but not override evidence blindly.
 * Benefit: Useful reporting even when AI is disabled or unavailable.
 */
export function classifyFailure(message = ''): FailureCategory {
  const m = message.toLowerCase();
  if (/locator|strict mode|waiting for|timeout.*locator/.test(m)) return 'TEST_DEFECT';
  if (/schema|invalid test data|missing.*field|zod/.test(m)) return 'DATA_DEFECT';
  if (/503|502|connection refused|dns|socket|service unavailable/.test(m)) return 'DEPENDENCY';
  if (/browser.*closed|worker.*crash|environment|certificate/.test(m)) return 'ENVIRONMENT';
  if (/expected.*received|status.*expected|assert|expect\(/.test(m)) return 'PRODUCT_DEFECT';
  return 'UNKNOWN';
}
