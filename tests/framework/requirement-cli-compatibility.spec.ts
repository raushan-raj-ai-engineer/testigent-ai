/** Runtime regression for tsx/CJS-compatible requirement CLI entrypoints. Author: Raushan Raj */
import { test, expect } from '@playwright/test';
import { execFile } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

test('requirement analyze CLI runs through project tsx without top-level await failure', async () => {
  const root = process.cwd();
  const directory = await mkdtemp(join(tmpdir(), 'req-cli-'));
  const source = join(directory, 'payment.md');
  await writeFile(source, [
    '# Saved Card Payment',
    '',
    '## Feature',
    'Payment',
    '',
    '## Test Steps',
    '1. Login',
    '2. Select saved card',
    '',
    '## Expected Results',
    '- Payment succeeds'
  ].join('\n'));

  const tsx = join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
  const { stdout, stderr } = await execFileAsync(tsx, ['scripts/requirement-analyze.ts', source], {
    cwd: root,
    env: { ...process.env }
  });

  expect(stderr).not.toContain('Top-level await is currently not supported');
  expect(stdout).toContain('"sourceType": "markdown"');
  expect(stdout).toContain('"title": "Saved Card Payment"');
});
