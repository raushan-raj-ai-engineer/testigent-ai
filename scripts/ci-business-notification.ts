import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { ProjectPaths } from '../src/framework/core/config/project.paths';
import type { ExecutionFacts } from '../src/framework/analytics/report.types';

/**
 * Author: Raushan Raj
 * Business Use: Sends exactly one final merged stakeholder email in CI only when BUSINESS_EMAIL_ENABLED=true.
 * How to use: Keep BUSINESS_EMAIL_ENABLED=false by default; configure SMTP secrets and set it true when delivery is approved.
 * Benefit: Dashboard publishing is independent from mail, disabled mail never touches SMTP, and shard jobs can never spam stakeholders.
 */
async function main(): Promise<void> {
  if (!truthy(process.env.BUSINESS_EMAIL_ENABLED)) {
    console.log('[business-email] Disabled (BUSINESS_EMAIL_ENABLED is not true). No SMTP connection attempted.');
    return;
  }

  process.env.MAIL_MODE = 'smtp';

  const reportDir = path.resolve(process.env.FINAL_BUSINESS_REPORT_DIR ?? ProjectPaths.businessReport());
  const jsonPath = path.join(reportDir, 'business-report.json');
  const dashboardPath = path.join(reportDir, 'index.html');
  if (!fs.existsSync(jsonPath) || !fs.existsSync(dashboardPath)) throw new Error(`Final business report is incomplete under ${reportDir}`);
  const facts = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as ExecutionFacts;

  if (!shouldNotify(facts)) {
    console.log(`[business-email] Enabled but skipped by MAIL_NOTIFY_ON=${process.env.MAIL_NOTIFY_ON ?? 'always'} for gate ${facts.qualityGate.status}.`);
    return;
  }

  try {
    validateDeliveryConfiguration();
    const { MailNotificationProvider } = await import('../src/framework/notifications/mail.notification.js');
    const result = await new MailNotificationProvider().send({
      facts,
      reportDir,
      dashboardPath,
      executiveSummaryPath: existing(path.join(reportDir, 'EXECUTIVE_SUMMARY.md')),
      publicReportUrl: cleanEnv('REPORT_PUBLIC_URL')
    });
    if (result.mode !== 'smtp') throw new Error(`CI notification expected smtp mode but provider returned ${result.mode}`);
    console.log(`[business-email] Sent one merged release notification. Message ID: ${result.messageId ?? 'n/a'}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (truthy(process.env.NOTIFICATION_STRICT)) throw error;
    console.warn(`[business-email-warning] ${message}`);
    console.warn('Dashboard/report publication remains valid because NOTIFICATION_STRICT is false.');
  }
}

function validateDeliveryConfiguration(): void {
  const required = ['MAIL_FROM', 'MAIL_TO', 'SMTP_HOST', 'SMTP_PORT'];
  const missing = required.filter(name => !cleanEnv(name));
  if (missing.length) throw new Error(`BUSINESS_EMAIL_ENABLED=true but required mail settings are missing: ${missing.join(', ')}`);
  const user = cleanEnv('SMTP_USER');
  const pass = cleanEnv('SMTP_PASS');
  if ((user && !pass) || (!user && pass)) throw new Error('SMTP_USER and SMTP_PASS must be configured together when SMTP authentication is used.');
}
function shouldNotify(facts: ExecutionFacts): boolean {
  const mode = (cleanEnv('MAIL_NOTIFY_ON') ?? 'always').toLowerCase();
  if (mode === 'attention') return facts.qualityGate.status !== 'PASSED';
  if (mode === 'passed') return facts.qualityGate.status === 'PASSED';
  return true;
}
function truthy(value?: string): boolean { return ['1', 'true', 'yes', 'on'].includes((value ?? '').trim().toLowerCase()); }
function cleanEnv(name: string): string | undefined { const value = process.env[name]?.trim(); return !value || value.startsWith('$(') ? undefined : value; }
function existing(file: string): string | undefined { return fs.existsSync(file) ? file : undefined; }
main().catch(error => { console.error(error); process.exitCode = 1; });
