import { spawnSync } from 'node:child_process';
import { ProjectPaths } from '../src/framework/core/config/project.paths';

const result = spawnSync('npx', ['playwright', 'show-report', ProjectPaths.htmlReport()], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
process.exitCode = result.status ?? 1;
