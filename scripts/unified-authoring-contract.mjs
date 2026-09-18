import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const qa = fs.readFileSync('scripts/qa.ts', 'utf8');
const workflow = fs.readFileSync('scripts/qa-create.ts', 'utf8');
const readme = fs.readFileSync('README.md', 'utf8');
const guide = fs.readFileSync('docs/73-v1.10.2-UNIFIED-TEST-CREATION.md', 'utf8');
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

check(pkg.version === '1.10.2', 'package version must be 1.10.2');
check(pkg.scripts?.['qa:create'] === 'tsx scripts/qa.ts create', 'qa:create must route through qa.ts create');
check(pkg.scripts?.['qa:create:workflow'] === 'tsx scripts/qa-create.ts', 'unified workflow script missing');
check(!pkg.scripts?.['test:complex-exploration'], 'separate test:complex-exploration command must not exist');
check(!String(pkg.scripts?.['validate:final:steps'] ?? '').includes('test:complex-exploration'), 'final validation must not invoke a separate complex suite');
check(String(pkg.scripts?.['test:framework:critical'] ?? '').includes('tests/framework'), 'full framework regression must cover unified exploration contract');

for (const command of ['create', 'new', 'explore', 'learn', 'generate']) {
  check(qa.includes(`case '${command}'`), `qa command '${command}' missing`);
}
check(qa.includes("case 'create': runUnifiedCreate(args)"), 'create does not use unified workflow');
check(qa.includes("case 'new': runUnifiedCreate(args)"), 'new compatibility alias does not use unified workflow');
check(qa.includes("case 'explore': runUnifiedCreate(['--auto-explore'"), 'explore compatibility alias does not use unified workflow');
check(qa.includes("case 'learn': runUnifiedCreate([`--learn="), 'learn compatibility alias does not use unified workflow');
check(qa.includes("case 'generate': runUnifiedCreate(args)"), 'generate compatibility alias does not use unified workflow');

for (const token of [
  'safeExplore', 'guidedLearn', 'loadRequirement', 'analyzeRequirement', 'generateFrameworkProposal',
  'generateExplorationProposal', 'validateExplorationProposal', 'validateProposal', 'review-and-promote',
]) check(workflow.includes(token), `unified workflow missing ${token}`);

check(readme.includes('ONE AUTHORING COMMAND') || readme.includes('Unified Test Creation Workflow'), 'README does not advertise unified authoring');
check(guide.includes('There is no dedicated user-facing `complex` command'), 'guide must explicitly remove separate complex mode');
check(fs.existsSync('tests/framework/unified-exploration-generation-contract.spec.ts'), 'unified exploration regression test missing');
check(!fs.existsSync('tests/framework/complex-exploration-generation-contract.spec.ts'), 'old complex-specific test filename must be removed');

if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({
  ok: true,
  version: pkg.version,
  primaryCommand: 'npm run qa -- create <source> [--auto-explore | --learn="Journey"]',
  compatibilityAliases: ['new', 'explore', 'learn', 'generate'],
  complexUiMode: 'automatic-inside-unified-workflow',
  regression: 'tests/framework/unified-exploration-generation-contract.spec.ts via test:framework:critical',
}, null, 2));
