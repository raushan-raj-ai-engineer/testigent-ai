import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import type { ExecutionFacts } from '../src/framework/analytics/report.types';
import { writeBusinessDashboard } from '../src/framework/reporting/business-dashboard.writer';
import { ReportHistoryStore } from '../src/framework/reporting/report-history.store';
import { ProjectPaths } from '../src/framework/core/config/project.paths';

/**
 * Author: Raushan Raj
 * Business Use: Regenerates the complete dashboard bundle from business-report.json without rerunning tests.
 * How to use: `npm run report:dashboard`; optionally set NOTIFY_REPORT_DIR for a merged report directory.
 * Benefit: Dashboard styling/client fixes can be regenerated independently from expensive automation execution.
 */
function main(): void {
  const reportDir = path.resolve(process.env.NOTIFY_REPORT_DIR ?? (process.env.REPORT_VARIANT === 'merged' ? path.join(ProjectPaths.reports(), 'business-merged') : ProjectPaths.businessReport()));
  const jsonPath = path.join(reportDir, 'business-report.json');
  if (!fs.existsSync(jsonPath)) throw new Error(`Missing ${jsonPath}. Run tests first.`);
  const facts = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as ExecutionFacts;
  const history = new ReportHistoryStore().read();
  writeBusinessDashboard(reportDir, facts, { history, reportUrl: process.env.REPORT_PUBLIC_URL });
  console.log(`Dashboard bundle generated: ${path.join(reportDir, 'index.html')}`);
}
main();
