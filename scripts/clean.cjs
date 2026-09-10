const fs = require('fs');

const defaultDirs = ['reports', 'test-results', 'playwright-report', 'blob-report', 'all-blob-reports', 'all-business-reports', '.healing', '.runtime', '.playwright-cli'];
const deepDirs = ['.report-history', '.auth', '.application-knowledge', '.proposal-backups'];
const deep = process.argv.includes('--all');

for (const dir of defaultDirs) fs.rmSync(dir, { recursive: true, force: true });
if (deep) for (const dir of deepDirs) fs.rmSync(dir, { recursive: true, force: true });

console.log(`Cleaned generated artifacts${deep ? ' and local run/auth history' : ''}.`);
