/** Regression tests for generated proposal review/promotion. Author: Raushan Raj */
import { expect, test } from '@playwright/test';
import { mkdtemp, mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  approveProposal,
  initializeProposalReview,
  inspectProposal,
  listProposals,
  promoteProposal,
  rejectProposal,
  reopenProposal
} from '../../src/framework/intelligence/review/proposal.review.js';
import type { GenerationManifest } from '../../src/framework/intelligence/core/models.js';

const header = (id: string): string => `/**\n * GENERATED PROPOSAL - REVIEW_REQUIRED\n * Requirement: ${id}\n * Do not merge before human review.\n * Author: Raushan Raj\n */\n`;

async function fileExists(path: string): Promise<boolean> { try { await access(path); return true; } catch { return false; } }

async function expectFailure(promise: Promise<unknown>, pattern: RegExp): Promise<void> {
  try {
    await promise;
    throw new Error('Expected operation to fail, but it succeeded.');
  } catch (error) {
    expect(error instanceof Error ? error.message : String(error)).toMatch(pattern);
  }
}

async function makeProject(): Promise<{ root: string; manifest: GenerationManifest; page: string; generatedTest: string }> {
  const root = await mkdtemp(join(tmpdir(), 'proposal-review-'));
  const page = 'projects/billing/src/pages/payment.page.ts';
  const generatedTest = 'projects/billing/tests/e2e/payment.generated.spec.ts';
  await mkdir(join(root, 'projects/billing/src/pages'), { recursive: true });
  await mkdir(join(root, 'projects/billing/tests/e2e'), { recursive: true });
  await writeFile(join(root, page), header('PAY-142') + `export class PaymentPage {\n  async performPrimaryAction(): Promise<void> {\n    throw new Error('REVIEW_REQUIRED: implement payment action');\n  }\n}\n`);
  await writeFile(join(root, generatedTest), header('PAY-142') + `import { test } from '@playwright/test';\ntest('payment', async () => {\n  test.fixme(true, 'REVIEW_REQUIRED: generated test');\n});\n`);
  const manifest: GenerationManifest = {
    requirementId: 'PAY-142',
    createdAt: new Date().toISOString(),
    reviewRequired: true,
    targetApplication: 'billing',
    reused: [],
    created: [
      { kind: 'page', path: page, reason: 'Created missing page proposal in the existing framework structure.' },
      { kind: 'test', path: generatedTest, reason: 'Created missing test proposal in the existing framework structure.' }
    ],
    warnings: []
  };
  const manifestDir = join(root, 'generated/requirements/PAY-142');
  await mkdir(manifestDir, { recursive: true });
  await writeFile(join(manifestDir, 'generation-manifest.json'), JSON.stringify(manifest, null, 2));
  await initializeProposalReview(root, manifest, [page, generatedTest]);
  return { root, manifest, page, generatedTest };
}

async function makeReviewClean(root: string, page: string, generatedTest: string): Promise<void> {
  // A review-clean generated UI abstraction must preserve the framework's
  // self-healing contract. Keep this fixture intentionally self-contained
  // because proposal lifecycle tests run with runTypecheck:false.
  await writeFile(join(root, page), header('PAY-142') + `type LocatorPlan = {\n  id: string;\n  businessName: string;\n  primary: { type: 'text'; value: string };\n};\n\nexport class PaymentPage {\n  private readonly paymentPlan: LocatorPlan = {\n    id: 'payment.primary-action',\n    businessName: 'Payment primary action',\n    primary: { type: 'text', value: 'Pay' }\n  };\n\n  private async healingClick(_plan: LocatorPlan): Promise<void> { return; }\n\n  async performPrimaryAction(): Promise<void> {\n    await this.healingClick(this.paymentPlan);\n  }\n}\n`);
  await writeFile(join(root, generatedTest), header('PAY-142') + `import { test, expect } from '@playwright/test';\ntest('payment', async () => { expect(true).toBeTruthy(); });\n`);
}

test.describe('generated proposal human review and promotion', () => {
  test('generated scaffold is listed but cannot be approved while implementation guards remain', async () => {
    const { root } = await makeProject();
    const listed = await listProposals(root);
    expect(listed).toEqual([expect.objectContaining({ requirementId: 'PAY-142', status: 'REVIEW_REQUIRED', targetApplication: 'billing' })]);
    const inspection = await inspectProposal(root, 'PAY-142');
    expect(inspection.approvable).toBeFalsy();
    expect(inspection.issues.join(' ')).toContain('test.fixme');
    await expectFailure(approveProposal(root, 'PAY-142', 'Reviewer', undefined, { runTypecheck: false }), /cannot be approved/i);
  });

  test('human-clean proposal can be approved and approval records exact hashes', async () => {
    const { root, page, generatedTest } = await makeProject();
    await makeReviewClean(root, page, generatedTest);
    const state = await approveProposal(root, 'PAY-142', 'Raushan Raj', 'Reviewed functional mappings and assertions.', { runTypecheck: false });
    expect(state.status).toBe('APPROVED');
    expect(state.reviewer).toBe('Raushan Raj');
    expect(Object.keys(state.approvedFileHashes ?? {})).toEqual(expect.arrayContaining([page, generatedTest]));
  });

  test('any file change after approval blocks promotion until it is reviewed again', async () => {
    const { root, page, generatedTest } = await makeProject();
    await makeReviewClean(root, page, generatedTest);
    await approveProposal(root, 'PAY-142', 'Reviewer', undefined, { runTypecheck: false });
    await writeFile(join(root, page), (await readFile(join(root, page), 'utf8')) + '\n// unreviewed change\n');
    await expectFailure(promoteProposal(root, 'PAY-142', { runTypecheck: false }), /changed after approval/i);
  });

  test('promotion changes ownership header, activates generated test filename and writes backup/audit', async () => {
    const { root, page, generatedTest } = await makeProject();
    await makeReviewClean(root, page, generatedTest);
    await approveProposal(root, 'PAY-142', 'Reviewer', undefined, { runTypecheck: false });
    const promotion = await promoteProposal(root, 'PAY-142', { runTypecheck: false });
    const activeTest = 'projects/billing/tests/e2e/payment.spec.ts';
    expect(promotion.files).toEqual(expect.arrayContaining([expect.objectContaining({ from: generatedTest, to: activeTest })]));
    expect(await fileExists(join(root, generatedTest))).toBeFalsy();
    expect(await fileExists(join(root, activeTest))).toBeTruthy();
    expect(await readFile(join(root, page), 'utf8')).toContain('HUMAN-APPROVED AUTOMATION');
    expect(await readFile(join(root, activeTest), 'utf8')).toContain('HUMAN-APPROVED AUTOMATION');
    expect(await fileExists(join(root, promotion.backupDirectory, generatedTest))).toBeTruthy();
    const inspection = await inspectProposal(root, 'PAY-142');
    expect(inspection.status).toBe('PROMOTED');
    expect(inspection.issues).toEqual([]);
  });

  test('promotion refuses to overwrite an existing human-owned active test', async () => {
    const { root, page, generatedTest } = await makeProject();
    await makeReviewClean(root, page, generatedTest);
    await writeFile(join(root, 'projects/billing/tests/e2e/payment.spec.ts'), `// human-owned test\n`);
    await approveProposal(root, 'PAY-142', 'Reviewer', undefined, { runTypecheck: false });
    await expectFailure(promoteProposal(root, 'PAY-142', { runTypecheck: false }), /will not be overwritten/i);
    expect(await readFile(join(root, 'projects/billing/tests/e2e/payment.spec.ts'), 'utf8')).toContain('human-owned');
  });

  test('reject and reopen preserve files and change only review state', async () => {
    const { root, page } = await makeProject();
    const before = await readFile(join(root, page), 'utf8');
    const rejected = await rejectProposal(root, 'PAY-142', 'Reviewer', 'Requirement needs clarification.');
    expect(rejected.status).toBe('REJECTED');
    const reopened = await reopenProposal(root, 'PAY-142', 'Reviewer', 'Requirement clarified.');
    expect(reopened.status).toBe('REVIEW_REQUIRED');
    expect(await readFile(join(root, page), 'utf8')).toBe(before);
  });

  test('a regenerated proposal invalidates an earlier approval', async () => {
    const { root, manifest, page, generatedTest } = await makeProject();
    await makeReviewClean(root, page, generatedTest);
    await approveProposal(root, 'PAY-142', 'Reviewer', undefined, { runTypecheck: false });
    const changed = header('PAY-142') + `type LocatorPlan = { id: string; businessName: string; primary: { type: 'text'; value: string } };\nexport class PaymentPage {\n  private readonly paymentPlan: LocatorPlan = { id: 'payment.primary-action.v2', businessName: 'Payment primary action', primary: { type: 'text', value: 'Pay now' } };\n  private async healingClick(_plan: LocatorPlan): Promise<void> { return; }\n  async performPrimaryAction(): Promise<void> { await this.healingClick(this.paymentPlan); }\n}\n`;
    await writeFile(join(root, page), changed);
    const newer = { ...manifest, createdAt: new Date(Date.now() + 1000).toISOString() };
    const state = await initializeProposalReview(root, newer, [page]);
    expect(state.status).toBe('REVIEW_REQUIRED');
    expect(state.approvedFileHashes).toBeUndefined();
  });
});
