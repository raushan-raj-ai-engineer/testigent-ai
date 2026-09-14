import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { spreadsheetSafeCsvCell } from '../src/framework/reporting/csv-security.js';

/**
 * Release qualification for CSV formula injection using a real spreadsheet viewer (LibreOffice Calc).
 * This is intentionally an explicit release command because CI images do not universally ship LibreOffice.
 */
const dangerous = ['=1+1', '+SUM(1,1)', '-10+20', '@cmd', '  =1+1', '\t=1+1', '\r=1+1'];
const viewer = process.env.CSV_VIEWER_BIN?.trim() || findExecutable(process.platform === 'win32' ? ['soffice.exe'] : ['libreoffice', 'soffice']);
if (!viewer) throw new Error('CSV_VIEWER_QUALIFICATION: LibreOffice/soffice not found. Set CSV_VIEWER_BIN to run viewer qualification.');
if (!findExecutable(process.platform === 'win32' ? ['tar.exe'] : ['unzip'])) throw new Error('CSV_VIEWER_QUALIFICATION: unzip-compatible tool is required to inspect XLSX formula nodes.');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'testigent-csv-viewer-'));
try {
  const csv = path.join(root, 'formula-safety.csv');
  fs.writeFileSync(csv, ['Value', ...dangerous.map(spreadsheetSafeCsvCell)].join('\n') + '\n', 'utf8');
  execFileSync(viewer, ['--headless', '--convert-to', 'xlsx', '--outdir', root, csv], { stdio: 'pipe' });
  const xlsx = path.join(root, 'formula-safety.xlsx');
  if (!fs.existsSync(xlsx)) throw new Error('CSV_VIEWER_QUALIFICATION: LibreOffice did not produce XLSX output.');
  const xml = process.platform === 'win32'
    ? execFileSync('tar.exe', ['-xOf', xlsx, 'xl/worksheets/sheet1.xml'], { encoding: 'utf8' })
    : execFileSync('unzip', ['-p', xlsx, 'xl/worksheets/sheet1.xml'], { encoding: 'utf8' });
  if (/<f(?:\s|>)/i.test(xml)) throw new Error('CSV_VIEWER_QUALIFICATION: spreadsheet viewer materialized a formula node from neutralized CSV text.');

  const reopen = path.join(root, 'reopen'); fs.mkdirSync(reopen);
  execFileSync(viewer, ['--headless', '--convert-to', 'csv', '--outdir', reopen, xlsx], { stdio: 'pipe' });
  const reopened = fs.readFileSync(path.join(reopen, 'formula-safety.csv'), 'utf8');
  if (/^(?:2|-?\d+(?:\.\d+)?)$/m.test(reopened) && !reopened.includes("'=1+1")) throw new Error('CSV_VIEWER_QUALIFICATION: formula-like input appears to have been evaluated during open/save.');
  console.log(JSON.stringify({ ok: true, viewer, cases: dangerous.length, formulaNodes: 0, roundTrip: 'PASS' }, null, 2));
} finally { fs.rmSync(root, { recursive: true, force: true }); }

function findExecutable(candidates: string[]): string | undefined {
  for (const candidate of candidates) {
    const probe = spawnSync(process.platform === 'win32' ? 'where' : 'which', [candidate], { encoding: 'utf8' });
    if (probe.status === 0) return probe.stdout.split(/\r?\n/).find(Boolean)?.trim();
  }
  return undefined;
}
