#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const apply = process.argv.includes('--apply');
const review = process.argv.includes('--review') || !apply;

function assertRepo() {
  const required = ['package.json', 'src/framework', 'projects'];
  const missing = required.filter(item => !fs.existsSync(path.join(root, item)));
  if (missing.length) {
    console.error(`Refusing cleanup: ${root} does not look like TestigentAI. Missing: ${missing.join(', ')}`);
    process.exit(2);
  }
}

const safeEphemeral = [
  'reports',
  'test-results',
  'playwright-report',
  'blob-report',
  'all-blob-reports',
  'all-business-reports',
  'coverage',
  'dist',
  '.runtime'
];

const reviewOnlyState = [
  '.auth',
  '.healing',
  '.report-history',
  '.application-knowledge',
  '.proposal-backups',
  'node_modules'
];

const legacyOrGenerated = [
  '.claude',
  '.codex',
  '.opencode',
  '.playwright',
  'opencode.json',
  'tsconfig.json.bak',
  'PATCH-README.md',
  'src/applications',
  'requirements',
  'test-data',
  'generated',
  'specs',
  '.upgrade-backup'
];

function sizeOf(target) {
  try {
    const stat = fs.lstatSync(target);
    if (!stat.isDirectory()) return stat.size;
    let total = 0;
    for (const entry of fs.readdirSync(target)) total += sizeOf(path.join(target, entry));
    return total;
  } catch { return 0; }
}

function human(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function existing(items) {
  return items.map(name => ({ name, full: path.join(root, name) }))
    .filter(item => fs.existsSync(item.full));
}

assertRepo();

const safe = existing(safeEphemeral);
const state = existing(reviewOnlyState);
const legacy = existing(legacyOrGenerated);

console.log('TestigentAI cleanup review');
console.log(`Repository: ${root}`);
console.log(`Mode: ${apply ? 'APPLY safe ephemeral cleanup' : 'DRY RUN / REVIEW'}`);

console.log('\nSAFE EPHEMERAL (auto-removable):');
if (!safe.length) console.log('  none');
for (const item of safe) console.log(`  ${item.name.padEnd(24)} ${human(sizeOf(item.full))}`);

console.log('\nSTATE / CACHE (review only; never auto-deleted):');
if (!state.length) console.log('  none');
for (const item of state) console.log(`  ${item.name.padEnd(24)} ${human(sizeOf(item.full))}`);

console.log('\nLEGACY / GENERATED CANDIDATES (review before deletion):');
if (!legacy.length) console.log('  none');
for (const item of legacy) console.log(`  ${item.name.padEnd(24)} ${human(sizeOf(item.full))}`);

if (apply) {
  console.log('\nDeleting safe ephemeral paths only...');
  for (const item of safe) {
    fs.rmSync(item.full, { recursive: true, force: true });
    console.log(`  removed ${item.name}`);
  }
  console.log('Safe cleanup complete. State/cache and legacy candidates were NOT deleted.');
} else if (review) {
  console.log('\nNo files were deleted. Run `npm run clean:runtime` to remove SAFE EPHEMERAL paths only.');
}
