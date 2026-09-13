import { expect, test } from '@playwright/test';
import type { GenerationProposal } from '../../src/framework/agentic/contracts/generation.types.js';
import { reviewGenerationProposal } from '../../src/framework/agentic/reviewer/generated-test-reviewer.js';

function proposal(content: string, overrides: Partial<GenerationProposal> = {}): GenerationProposal {
  return { version: 1, id: 'proposal-1', planId: 'plan-1', requirementRef: 'REQ-1', project: 'demo', kind: 'test', targetPath: 'projects/demo/tests/e2e/account.generated.spec.ts', state: 'REVIEW_REQUIRED', rationale: 'candidate', confidence: 0.9, duplicateDetected: false, contentSha256: 'abc123', content, evidence: [{ kind: 'requirement', ref: 'REQ-1' }], ...overrides };
}

test.describe('Agentic reviewer contract', () => {
  test('clean generated test remains human-review required rather than auto-promoted', () => {
    const result = reviewGenerationProposal(proposal("import { test, expect } from '@playwright/test';\ntest('create account @requirement:REQ-1', async ({ app }) => { expect(app).toBeTruthy(); });"));
    expect(result.deterministicValidationPassed).toBe(true);
    expect(result.state).toBe('REVIEW_REQUIRED');
    expect(result.requiresHumanApproval).toBe(true);
  });
  test('raw Playwright source bypass is rejected', () => {
    const result = reviewGenerationProposal(proposal("import { test, expect } from '@playwright/test';\ntest('bad @requirement:REQ-1', async ({ page }) => { await page.goto('/'); expect(page).toBeTruthy(); });"));
    expect(result.state).toBe('REJECTED');
    expect(result.findings.some(item => item.ruleId === 'raw-playwright-ui')).toBe(true);
  });
  test('cross-project references are rejected deterministically', () => {
    const content = "import { test, expect } from '@playwright/test';\nconst foreign = 'projects/sdet-practice/tests/e2e/user.spec.ts';\ntest('x @requirement:REQ-1', async () => { expect(foreign).toBeTruthy(); });";
    const result = reviewGenerationProposal(proposal(content));
    expect(result.state).toBe('REJECTED');
    expect(result.findings.some(item => item.ruleId === 'cross-project-reference')).toBe(true);
  });

  test('credential literals are critical findings', () => {
    const credentialAssignment = ["const api", "Key = '", "synthetic-sensitive-value", "';"].join('');
    const result = reviewGenerationProposal(proposal(`${credentialAssignment}\ntest('x @requirement:REQ-1', async () => { expect(true).toBe(true); });`));
    expect(result.findings.some(item => item.ruleId === 'literal-secret' && item.severity === 'critical')).toBe(true);
  });
});
