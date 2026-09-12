import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { evaluateSecurityAudit, type SecurityExceptionFile } from '../src/framework/security/advisory.policy';

const result = spawnSync('npm', ['audit', '--json'], {
  encoding: 'utf8',
  shell: process.platform === 'win32',
});

if (result.error) {
  console.error(`npm audit could not start: ${result.error.message}`);
  process.exit(1);
}

let audit: any;
try { audit = JSON.parse(result.stdout || '{}'); }
catch {
  console.error('npm audit did not return valid JSON.');
  console.error(result.stderr || result.stdout);
  process.exit(1);
}

if (!audit.vulnerabilities && result.status !== 0) {
  console.error('npm audit failed before a vulnerability report was produced.');
  console.error(result.stderr || result.stdout);
  process.exit(1);
}

const policyPath = path.resolve(process.env.SECURITY_EXCEPTION_FILE ?? 'config/security-exceptions.json');
if (!fs.existsSync(policyPath)) throw new Error(`Security exception policy is missing: ${policyPath}`);
const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8')) as SecurityExceptionFile;
const evaluated = evaluateSecurityAudit(audit, policy);

if (evaluated.blocking.length) {
  console.error(JSON.stringify({
    ok: false,
    blocking: evaluated.blocking,
    allowed: evaluated.allowed.map(item => ({
      package: item.package,
      advisoryId: item.advisoryId,
      affectedRange: item.affectedRange,
      owner: item.exception.owner,
      expiresAt: item.exception.expiresAt,
      rationale: item.exception.rationale,
    })),
  }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  highOrCriticalAdvisories: evaluated.advisories.length,
  allowed: evaluated.allowed.map(item => ({
    package: item.package,
    advisoryId: item.advisoryId,
    affectedRange: item.affectedRange,
    owner: item.exception.owner,
    expiresAt: item.exception.expiresAt,
    rationale: item.exception.rationale,
  })),
  policy: path.relative(process.cwd(), policyPath),
}, null, 2));
