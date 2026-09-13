import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { RequirementAnalysis } from '../../src/framework/intelligence/core/models.js';
import { buildAgenticTestPlan } from '../../src/framework/agentic/planner/test-planner.js';
import { analyzeAgenticImpact } from '../../src/framework/agentic/planner/impact-planner.js';

function analysis(overrides: Partial<RequirementAnalysis> = {}): RequirementAnalysis {
  return {
    requirement: {
      sourceType: 'markdown', sourceId: 'REQ-101', title: 'User can create account', description: 'Create account through UI',
      preconditions: ['Visitor is logged out'], scenarioHints: ['Create account successfully'], acceptanceCriteria: ['Account should be created'], manualTestSteps: [{ order: 1, action: 'Submit registration', expectedResult: 'Account is created' }], expectedResults: ['Account is created'], tags: ['@critical'], priority: 'P1', feature: 'registration', links: [],
    },
    suggestedLayers: ['UI'], suggestedScenarios: ['Create account successfully'], missingInformation: [], conflicts: [], readiness: 'HIGH', reusableCandidates: [], applicationResolution: { app: 'demo', source: 'tag', reason: 'Explicit project scope.', candidates: ['demo'] }, applicationKnowledge: [], knowledgeGaps: [],
    ...overrides,
  };
}

test.describe('Agentic planner contract', () => {
  test('explicit requirement evidence can produce an accepted deterministic plan', () => {
    const plan = buildAgenticTestPlan(analysis());
    expect(plan.state).toBe('ACCEPTED');
    expect(plan.project).toBe('demo');
    expect(plan.scenarios).toHaveLength(1);
    expect(plan.evidence.some(item => item.kind === 'requirement')).toBe(true);
  });
  test('blocked requirement never becomes accepted because confidence is high', () => {
    const plan = buildAgenticTestPlan(analysis({ readiness: 'BLOCKED', conflicts: ['Expected 200 conflicts with expected 409.'] }));
    expect(plan.state).toBe('REVIEW_REQUIRED');
  });
  test('change impact remains project scoped and deterministic', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'testigent-impact-'));
    try {
      fs.mkdirSync(path.join(root, 'projects/demo/tests/ui'), { recursive: true });
      fs.writeFileSync(path.join(root, 'projects/demo/tests/ui/profile.spec.ts'), "import { test } from '@playwright/test';\n// profile page coverage\ntest('profile', async () => {});\n");
      const result = analyzeAgenticImpact(root, 'demo', ['projects/demo/src/pages/profile.page.ts']);
      expect(result.state).toBe('ACCEPTED');
      expect(result.affectedTests[0]?.testPath).toContain('profile.spec.ts');
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
});
