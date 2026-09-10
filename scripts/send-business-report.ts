import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import type { ExecutionFacts } from '../src/framework/analytics/report.types';
import { MailNotificationProvider } from '../src/framework/notifications/mail.notification';
import { ProjectPaths } from '../src/framework/core/config/project.paths';

/**
 * Author: Raushan Raj
 * Business Use: Sends or previews the final business report after a local run or merged CI run.
 * How to use: report:mail:preview is safe; report:mail sends only when MAIL_MODE=smtp.
 * Benefit: Notification is separated from Playwright execution, preventing duplicate shard emails and false test failures caused by mail outages.
 */
async function main(): Promise<void> {
  const reportDir = path.resolve(process.argv[2] ?? process.env.NOTIFY_REPORT_DIR ?? ProjectPaths.businessReport());
  const jsonPath = path.join(reportDir, 'business-report.json');
  const dashboardPath = path.join(reportDir, 'index.html');
  if (!fs.existsSync(jsonPath) || !fs.existsSync(dashboardPath)) throw new Error(`Business report is incomplete under ${reportDir}. Run tests/report merge first.`);
  const facts = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as ExecutionFacts;
  if (!shouldNotify(facts)) {
    console.log(`Business email skipped by MAIL_NOTIFY_ON=${process.env.MAIL_NOTIFY_ON ?? 'always'} for quality gate ${facts.qualityGate.status}.`);
    return;
  }
  const provider = new MailNotificationProvider();
  try {
    const result = await provider.send({
      facts,
      reportDir,
      dashboardPath,
      executiveSummaryPath: fs.existsSync(path.join(reportDir, 'EXECUTIVE_SUMMARY.md')) ? path.join(reportDir, 'EXECUTIVE_SUMMARY.md') : undefined,
      publicReportUrl: process.env.REPORT_PUBLIC_URL
    });
    if (result.mode === 'preview') {
      console.log(`Mail preview created: ${result.previewPath}`);
      console.log(`Attachments: ${(result.attachmentNames ?? []).join(', ') || 'none'}`);
    } else {
      console.log(`Business report email sent. Message ID: ${result.messageId ?? 'n/a'}`);
      console.log(`Attachments: ${(result.attachmentNames ?? []).join(', ') || 'none'}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (process.env.NOTIFICATION_STRICT === 'true') throw error;
    console.warn(`[notification-warning] ${message}`);
    console.warn('Test/report result remains unchanged because NOTIFICATION_STRICT is not true.');
  }
}

function shouldNotify(facts: ExecutionFacts): boolean {
  const mode = (process.env.MAIL_NOTIFY_ON ?? 'always').toLowerCase();
  if (mode === 'attention') return facts.qualityGate.status !== 'PASSED';
  if (mode === 'passed') return facts.qualityGate.status === 'PASSED';
  return true;
}

main().catch(error => { console.error(error); process.exitCode = 1; });
