import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const result = spawnSync('npm', ['audit', '--json'], {
  encoding: 'utf8',
  shell: process.platform === 'win32',
});

if (result.error) {
  console.error(`npm audit could not start: ${result.error.message}`);
  process.exit(1);
}

let audit: any;
try {
  audit = JSON.parse(result.stdout || '{}');
} catch {
  console.error('npm audit did not return valid JSON.');
  console.error(result.stderr || result.stdout);
  process.exit(1);
}

// npm audit normally exits non-zero when vulnerabilities are found. That is not
// itself a transport failure; the parsed vulnerability list below decides policy.
if (!audit.vulnerabilities && result.status !== 0) {
  console.error('npm audit failed before a vulnerability report was produced.');
  console.error(result.stderr || result.stdout);
  process.exit(1);
}

const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
const xlsxVersion = lock.packages?.['node_modules/xlsx']?.version;
const findings = Object.entries(audit.vulnerabilities ?? {}).filter(([, value]: any) =>
  ['high', 'critical'].includes(value.severity),
);

const allowlisted = findings.filter(([name]) => name === 'xlsx' && xlsxVersion === '0.20.3');
const blocking = findings.filter(([name]) => !(name === 'xlsx' && xlsxVersion === '0.20.3'));

if (blocking.length) {
  console.error(JSON.stringify({
    ok: false,
    blocking: blocking.map(([name, value]: any) => ({
      name,
      severity: value.severity,
      via: value.via,
    })),
  }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  highOrCritical: findings.length,
  allowlisted: allowlisted.map(([name]) => ({
    name,
    version: xlsxVersion,
    reason: 'Vendored SheetJS 0.20.3 exception. Review docs/SOURCES.md before changing this version or policy.',
  })),
}, null, 2));
