import fs from 'node:fs';
import path from 'node:path';
import type { BusinessAttachment, ExecutionFacts } from '../analytics/report.types';
import { renderBusinessHtml, type BusinessDashboardOptions } from './business-html.renderer';

/**
 * Author: Raushan Raj
 * Business Use: Writes the complete business dashboard bundle (HTML, client JS, CSV, evidence and JSON) from one deterministic facts object.
 * How to use: Reporter and dashboard regeneration scripts call this writer instead of writing index.html directly.
 * Benefit: Local, CI, merged and emailed reports use the same bundle contract and cannot drift into different dashboard behaviors.
 */
export function writeBusinessDashboard(outputDir: string, input: ExecutionFacts, options: BusinessDashboardOptions = {}): ExecutionFacts {
  fs.mkdirSync(outputDir, { recursive: true });
  const facts = cloneFacts(input);
  materializeEvidence(outputDir, facts);
  const assetsDir = path.join(outputDir, 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });
  const clientSource = path.join(__dirname, 'assets', 'dashboard.js');
  if (!fs.existsSync(clientSource)) throw new Error(`Dashboard client asset not found: ${clientSource}`);
  fs.copyFileSync(clientSource, path.join(assetsDir, 'dashboard.js'));
  fs.writeFileSync(path.join(outputDir, 'business-tests.csv'), toCsv(facts), 'utf8');
  fs.writeFileSync(path.join(outputDir, 'business-report.json'), JSON.stringify(facts, null, 2), 'utf8');
  fs.writeFileSync(path.join(outputDir, 'index.html'), renderBusinessHtml(facts, options), 'utf8');
  return facts;
}

function materializeEvidence(outputDir: string, facts: ExecutionFacts): void {
  const includeVideo = process.env.BUSINESS_REPORT_INCLUDE_VIDEO === 'true';
  const evidenceRoot = path.join(outputDir, 'evidence');
  for (const result of facts.results) {
    for (const attachment of result.attachments ?? []) {
      if (!attachment.sourcePath || !fs.existsSync(attachment.sourcePath) || !shouldCopy(attachment, includeVideo)) continue;
      const testDir = path.join(evidenceRoot, safeFile(`${result.project}-${result.testId}`));
      fs.mkdirSync(testDir, { recursive: true });
      const ext = path.extname(attachment.sourcePath);
      const targetName = safeFile(`${attachment.name}${ext && !attachment.name.endsWith(ext) ? ext : ''}`);
      const targetPath = uniquePath(path.join(testDir, targetName));
      fs.copyFileSync(attachment.sourcePath, targetPath);
      attachment.reportPath = path.relative(outputDir, targetPath).split(path.sep).join('/');
    }
  }
}

function shouldCopy(attachment: BusinessAttachment, includeVideo: boolean): boolean {
  if (attachment.contentType.startsWith('image/')) return true;
  if (attachment.contentType.includes('zip')) return true;
  if (attachment.contentType.includes('json') || attachment.contentType.startsWith('text/')) return true;
  if (includeVideo && attachment.contentType.startsWith('video/')) return true;
  return false;
}

function uniquePath(candidate: string): string {
  if (!fs.existsSync(candidate)) return candidate;
  const ext = path.extname(candidate);
  const base = candidate.slice(0, candidate.length - ext.length);
  let index = 2;
  while (fs.existsSync(`${base}-${index}${ext}`)) index += 1;
  return `${base}-${index}${ext}`;
}

function toCsv(facts: ExecutionFacts): string {
  const rows: string[][] = [['Scenario', 'Status', 'Test Type', 'Layers', 'Project', 'Tags', 'Duration ms', 'Retries', 'Flaky', 'Self Healed', 'Failure Category', 'Skip Category', 'Skip Reason', 'Source File']];
  const healed = new Set(facts.healing.records.map(record => record.testId).filter(Boolean));
  for (const result of facts.results) rows.push([
    result.title,
    result.status,
    result.testType ?? 'OTHER',
    (result.layers ?? []).join('+'),
    result.project,
    result.tags.join(' '),
    String(result.totalDurationMs),
    String(result.retriesUsed),
    String(result.flaky),
    String(healed.has(result.testId)),
    result.failureCategory ?? '',
    result.skipCategory ?? '',
    result.skipReason ?? '',
    result.sourceFile ?? ''
  ]);
  return rows.map(row => row.map(csvCell).join(',')).join('\n') + '\n';
}

function csvCell(value: string): string { return `"${value.replaceAll('"', '""')}"`; }
function safeFile(value: string): string { return value.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 140); }
function cloneFacts(value: ExecutionFacts): ExecutionFacts { return JSON.parse(JSON.stringify(value)) as ExecutionFacts; }
