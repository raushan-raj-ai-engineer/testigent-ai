import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  fetchBulkAdvisoryAudit,
  type AuditLikeReport,
} from '../src/framework/security/npm-bulk-audit';
import {
  evaluateSecurityAudit,
  type SecurityExceptionFile,
} from '../src/framework/security/advisory.policy';

type AuditSource = 'npm-cli' | 'npm-bulk-advisory';

async function main(): Promise<void> {
  const mode = String(process.env.SECURITY_AUDIT_SOURCE ?? 'auto').toLowerCase();

  if (!['auto', 'npm', 'bulk'].includes(mode)) {
    throw new Error(
      "SECURITY_AUDIT_SOURCE must be one of 'auto', 'npm', or 'bulk'.",
    );
  }

  let audit: AuditLikeReport | undefined;
  let source: AuditSource | undefined;
  let npmFailure = '';

  if (mode !== 'bulk') {
    const result = spawnSync('npm', ['audit', '--json'], {
      encoding: 'utf8',
      shell: process.platform === 'win32',
    });

    if (result.error) {
      npmFailure = `npm audit could not start: ${result.error.message}`;
    } else {
      let parsed: unknown;

      try {
        parsed = JSON.parse(result.stdout || '{}');
      } catch {
        npmFailure = 'npm audit did not return valid JSON.';
      }

      if (
        parsed
        && typeof parsed === 'object'
        && !Array.isArray(parsed)
        && 'vulnerabilities' in parsed
      ) {
        audit = parsed as AuditLikeReport;
        source = 'npm-cli';
      } else if (!npmFailure) {
        npmFailure =
          result.stderr?.trim()
          || result.stdout?.trim()
          || `npm audit exited with status ${result.status ?? 'unknown'} without a vulnerability report.`;
      }
    }
  }

  if (!audit) {
    if (mode === 'npm') {
      console.error('npm audit failed before a vulnerability report was produced.');
      if (npmFailure) console.error(npmFailure);
      process.exit(1);
    }

    if (npmFailure) {
      console.warn(
        '[security] npm audit produced no usable vulnerability report; '
        + 'falling back to npm Bulk Advisory data.',
      );
    }

    try {
      audit = await fetchBulkAdvisoryAudit();
      source = 'npm-bulk-advisory';
    } catch (error) {
      console.error(
        'Security audit failed closed: neither npm audit nor the npm Bulk Advisory fallback produced usable evidence.',
      );
      if (npmFailure) console.error(`npm audit: ${npmFailure}`);
      console.error(
        `bulk advisory: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exit(1);
    }
  }

  const policyPath = path.resolve(
    process.env.SECURITY_EXCEPTION_FILE ?? 'config/security-exceptions.json',
  );

  if (!fs.existsSync(policyPath)) {
    throw new Error(`Security exception policy is missing: ${policyPath}`);
  }

  const policy = JSON.parse(
    fs.readFileSync(policyPath, 'utf8'),
  ) as SecurityExceptionFile;

  const evaluated = evaluateSecurityAudit(audit, policy);

  if (evaluated.blocking.length) {
    console.error(JSON.stringify({
      ok: false,
      source,
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
    source,
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
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
