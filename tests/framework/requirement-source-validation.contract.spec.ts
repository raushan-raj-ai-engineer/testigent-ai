import { expect, test } from '@playwright/test';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadRequirement } from '../../src/framework/intelligence/adapters/source.factory.js';

test.describe('requirement source validation contract', () => {
  test.skip(process.env.RUN_FRAMEWORK_TESTS !== 'true', 'Framework contract test.');

  test('loads an existing Markdown requirement and gives a precise missing-file error', async () => {
    const root = await mkdtemp(join(tmpdir(), 'testigent-source-'));
    const requirementPath = join(root, 'checkout.md');
    await writeFile(requirementPath, '# Checkout\n\n## Acceptance Criteria\n- Order is created\n', 'utf8');

    const requirement = await loadRequirement(requirementPath);
    expect(requirement.sourceType).toBe('markdown');
    expect(requirement.sourceId).toBe('checkout');
    expect(requirement.title).toBe('Checkout');
    expect(requirement.acceptanceCriteria).toContain('Order is created');

    await expect(loadRequirement(join(root, 'missing.md'))).rejects.toThrow(/Requirement file not found/);
  });

  test('unified create validates requirement before opening exploration', async () => {
    const source = await readFile(join(process.cwd(), 'scripts/qa-create.ts'), 'utf8');
    const loadIndex = source.indexOf('requirement = await loadRequirement(source)');
    const captureIndex = source.indexOf('const captured = await captureKnowledge');
    expect(loadIndex).toBeGreaterThan(-1);
    expect(captureIndex).toBeGreaterThan(-1);
    expect(loadIndex).toBeLessThan(captureIndex);
  });
});
