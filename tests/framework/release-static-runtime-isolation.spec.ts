import { expect, test } from '@playwright/test';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

test.describe('release static runtime isolation contract', () => {
  test.skip(
    process.env.RUN_FRAMEWORK_TESTS !== 'true',
    'Framework contract test.'
  );

  test('ignores sparse generated proposal workspaces', async () => {
    const root = process.cwd();

    const fixtureRoot = join(
      root,
      '.testigent',
      'runtime-isolation-contract'
    );

    const brokenRuntimeFile = join(
      fixtureRoot,
      'workspace',
      'projects',
      'demo',
      'tests',
      'e2e',
      'runtime-only.generated.spec.ts'
    );

    try {
      await mkdir(
        join(
          fixtureRoot,
          'workspace',
          'projects',
          'demo',
          'tests',
          'e2e'
        ),
        { recursive: true }
      );

      // This import intentionally does not resolve.
      // release-static must ignore .testigent runtime workspaces.
      await writeFile(
        brokenRuntimeFile,
        "import './missing-runtime-only-module';\n",
        'utf8'
      );

      const result = spawnSync(
        process.execPath,
        ['scripts/release-static-check.mjs'],
        {
          cwd: root,
          encoding: 'utf8'
        }
      );

      expect(
        result.status,
        `${result.stdout}\n${result.stderr}`
      ).toBe(0);
    } finally {
      await rm(fixtureRoot, {
        recursive: true,
        force: true
      });
    }
  });
});
