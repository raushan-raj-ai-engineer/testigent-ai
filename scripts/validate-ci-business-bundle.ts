import fs from 'node:fs';
import path from 'node:path';
import { ProjectPaths } from '../src/framework/core/config/project.paths';
import type { ExecutionFacts } from '../src/framework/analytics/report.types';

/**
 * Author: Raushan Raj
 * Business Use: CI release gate for the complete V3 dashboard bundle before artifact publication or stakeholder mail.
 * How to use: Run ci:business:validate against reports/<APP>/business after merge/finalization.
 * Benefit: Prevents publishing an HTML shell with missing JavaScript, CSV, evidence or inconsistent business counts.
 */
function main(): void {
  const reportDir = path.resolve(process.env.FINAL_BUSINESS_REPORT_DIR ?? ProjectPaths.businessReport());
  const jsonPath = path.join(reportDir, 'business-report.json');
  const htmlPath = path.join(reportDir, 'index.html');
  const jsPath = path.join(reportDir, 'assets', 'dashboard.js');
  const csvPath = path.join(reportDir, 'business-tests.csv');
  [jsonPath, htmlPath, jsPath, csvPath].forEach(requireNonEmptyFile);

  const facts = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as ExecutionFacts;
  if (facts.total !== facts.results.length) throw new Error(`Business total mismatch: total=${facts.total}, results=${facts.results.length}`);
  if (facts.total !== facts.passed + facts.failed + facts.skipped) throw new Error(`Status total mismatch: ${facts.passed}+${facts.failed}+${facts.skipped} != ${facts.total}`);
  if (facts.scope && facts.scope.includedTests !== facts.total) throw new Error(`Scope mismatch: includedTests=${facts.scope.includedTests}, total=${facts.total}`);

  const html = fs.readFileSync(htmlPath, 'utf8');
  if (!html.includes('assets/dashboard.js')) throw new Error('Interactive dashboard asset reference is missing from index.html');
  if (!html.includes('statusDonut')) throw new Error('Execution status graph container is missing from index.html');
  if (!html.includes('Test Explorer')) throw new Error('Test Explorer is missing from index.html');

  let evidenceChecked = 0;
  for (const result of facts.results) {
    for (const attachment of result.attachments ?? []) {
      if (!attachment.reportPath) continue;
      evidenceChecked += 1;
      requireNonEmptyFile(path.resolve(reportDir, attachment.reportPath));
    }
  }

  console.log(`CI dashboard validation passed: ${facts.total} business scenario(s), ${facts.passRate}% pass rate, ${evidenceChecked} materialized evidence file(s).`);
}
function requireNonEmptyFile(file: string): void {
  if (!fs.existsSync(file)) throw new Error(`Required dashboard file missing: ${file}`);
  if (fs.statSync(file).size <= 0) throw new Error(`Dashboard file is empty: ${file}`);
}
main();
