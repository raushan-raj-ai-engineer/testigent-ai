import fs from 'node:fs';
import path from 'node:path';
import { buildBusinessEmailHtml, buildBusinessEmailText } from './business-email.template';
import { buildStaticBusinessReportHtml } from './business-email-static-report';
import type { BusinessNotificationPayload, BusinessNotificationProvider, BusinessNotificationResult } from './notification.types';

interface TransporterLike {
  verify?(): Promise<unknown>;
  sendMail(options: unknown): Promise<{ messageId?: string; message?: Buffer | string }>;
}
interface NodemailerModuleShape {
  default?: { createTransport?: (options: unknown) => TransporterLike };
  createTransport?: (options: unknown) => TransporterLike;
}
type CreateTransport = (options: unknown) => TransporterLike;

/**
 * Author: Raushan Raj
 * Business Use: Sends business release notifications through provider-neutral SMTP or creates a safe local .eml preview.
 * How to use: MAIL_MODE=preview for validation; MAIL_MODE=smtp with SMTP_* and MAIL_* variables for real delivery.
 * Benefit: Notification stays decoupled from test execution and remains compatible with the V3 multi-file interactive dashboard.
 */
export class MailNotificationProvider implements BusinessNotificationProvider {
  async send(payload: BusinessNotificationPayload): Promise<BusinessNotificationResult> {
    const mode = (process.env.MAIL_MODE ?? 'preview').toLowerCase() === 'smtp' ? 'smtp' : 'preview';
    const createTransport = await loadCreateTransport();
    const recipients = splitAddresses(process.env.MAIL_TO);
    const from = process.env.MAIL_FROM ?? process.env.SMTP_USER ?? 'automation-report@example.invalid';
    const subject = buildSubject(payload);
    const html = buildBusinessEmailHtml(payload.facts, payload.publicReportUrl);
    const text = buildBusinessEmailText(payload.facts, payload.publicReportUrl);
    const attachments = buildAttachments(payload);

    if (mode === 'preview') {
      const transporter = createTransport({ streamTransport: true, buffer: true, newline: 'unix' });
      const info = await transporter.sendMail({
        from,
        to: recipients.length ? recipients : ['preview@example.invalid'],
        cc: splitAddresses(process.env.MAIL_CC),
        bcc: splitAddresses(process.env.MAIL_BCC),
        replyTo: process.env.MAIL_REPLY_TO || undefined,
        subject,
        text,
        html,
        attachments
      });
      const previewDir = path.resolve(process.env.MAIL_PREVIEW_DIR ?? 'reports/notifications');
      fs.mkdirSync(previewDir, { recursive: true });
      const previewPath = path.join(previewDir, 'latest-business-report.eml');
      const raw = Buffer.isBuffer(info.message) ? info.message : Buffer.from(String(info.message ?? ''));

      // Keep the top-level preview directory deterministic: one file always points to the latest preview.
      cleanupLegacyTopLevelPreviews(previewDir, previewPath);
      fs.writeFileSync(previewPath, raw);

      // Optional history is intentionally stored below archive/ so wildcard/open commands do not open every old preview.
      if (boolEnv('MAIL_PREVIEW_ARCHIVE', false)) {
        const archiveDir = path.join(previewDir, 'archive');
        fs.mkdirSync(archiveDir, { recursive: true });
        const archivePath = path.join(archiveDir, `business-report-${safeFile(payload.facts.runId)}.eml`);
        fs.writeFileSync(archivePath, raw);
      }

      return { provider: 'smtp', mode: 'preview', delivered: false, messageId: info.messageId, previewPath, attachmentNames: attachments.map(item => item.filename) };
    }

    validateSmtp(recipients);
    const transporter = createTransport(buildSmtpTransportOptions());
    if (process.env.MAIL_VERIFY_CONNECTION === 'true' && transporter.verify) await transporter.verify();
    const info = await transporter.sendMail({
      from,
      to: recipients,
      cc: splitAddresses(process.env.MAIL_CC),
      bcc: splitAddresses(process.env.MAIL_BCC),
      replyTo: process.env.MAIL_REPLY_TO || undefined,
      subject,
      text,
      html,
      attachments
    });
    return { provider: 'smtp', mode: 'smtp', delivered: true, messageId: info.messageId, attachmentNames: attachments.map(item => item.filename) };
  }
}

/**
 * Author: Raushan Raj
 * Business Use: Verifies SMTP connectivity/authentication without sending a business email.
 */
export async function verifySmtpConnection(): Promise<void> {
  validateSmtp(splitAddresses(process.env.MAIL_TO));
  const createTransport = await loadCreateTransport();
  const transporter = createTransport(buildSmtpTransportOptions());
  if (!transporter.verify) throw new Error('Loaded Nodemailer transporter does not expose verify().');
  await transporter.verify();
}

async function loadCreateTransport(): Promise<CreateTransport> {
  const dynamicImport = new Function('moduleName', 'return import(moduleName)') as (moduleName: string) => Promise<NodemailerModuleShape>;
  let module: NodemailerModuleShape;
  try {
    module = await dynamicImport('nodemailer');
  } catch (error) {
    throw new Error(`Nodemailer is required for mail notifications. Run npm install nodemailer. ${error instanceof Error ? error.message : String(error)}`);
  }
  const createTransport = module.default?.createTransport ?? module.createTransport;
  if (typeof createTransport !== 'function') throw new Error('Loaded nodemailer module does not expose createTransport().');
  return createTransport;
}

function cleanupLegacyTopLevelPreviews(previewDir: string, latestPath: string): void {
  const latestName = path.basename(latestPath);
  for (const name of fs.readdirSync(previewDir)) {
    if (name === latestName) continue;
    if (!/^business-report-.*\.eml$/i.test(name)) continue;
    const candidate = path.join(previewDir, name);
    if (fs.statSync(candidate).isFile()) fs.rmSync(candidate, { force: true });
  }
}

function buildSmtpTransportOptions(): Record<string, unknown> {
  return {
    host: required('SMTP_HOST'),
    port: numberEnv('SMTP_PORT', 587),
    secure: boolEnv('SMTP_SECURE', false),
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: required('SMTP_PASS') } : undefined,
    requireTLS: boolEnv('SMTP_REQUIRE_TLS', true),
    connectionTimeout: numberEnv('SMTP_CONNECTION_TIMEOUT_MS', 15000),
    greetingTimeout: numberEnv('SMTP_GREETING_TIMEOUT_MS', 15000),
    socketTimeout: numberEnv('SMTP_SOCKET_TIMEOUT_MS', 30000),
    tls: process.env.SMTP_SERVERNAME ? { servername: process.env.SMTP_SERVERNAME } : undefined,
    disableUrlAccess: true
  };
}

function buildAttachments(payload: BusinessNotificationPayload): Array<{ filename: string; path?: string; content?: string; contentType?: string }> {
  const attachments: Array<{ filename: string; path?: string; content?: string; contentType?: string }> = [];
  if (boolEnv('MAIL_ATTACH_STATIC_REPORT', true)) {
    attachments.push({
      filename: `automation-business-report-${safeFile(payload.facts.runId)}.html`,
      content: buildStaticBusinessReportHtml(payload.facts),
      contentType: 'text/html; charset=utf-8'
    });
  }
  if (boolEnv('MAIL_ATTACH_CSV', true)) {
    const csvPath = path.join(payload.reportDir, 'business-tests.csv');
    if (fs.existsSync(csvPath)) attachments.push({ filename: `business-tests-${safeFile(payload.facts.runId)}.csv`, path: csvPath, contentType: 'text/csv' });
  }
  if (boolEnv('MAIL_ATTACH_EXECUTIVE_SUMMARY', false) && payload.executiveSummaryPath && fs.existsSync(payload.executiveSummaryPath)) {
    attachments.push({ filename: 'EXECUTIVE_SUMMARY.md', path: payload.executiveSummaryPath, contentType: 'text/markdown' });
  }
  if (boolEnv('MAIL_ATTACH_JSON', false)) {
    const jsonPath = path.join(payload.reportDir, 'business-report.json');
    if (fs.existsSync(jsonPath)) attachments.push({ filename: 'business-report.json', path: jsonPath, contentType: 'application/json' });
  }
  return attachments;
}

function buildSubject(payload: BusinessNotificationPayload): string {
  const prefix = process.env.MAIL_SUBJECT_PREFIX ?? '[Automation]';
  const gate = payload.facts.qualityGate.status === 'PASSED' ? 'PASS' : 'ATTENTION';
  return `${prefix} ${gate} - ${payload.facts.application} - ${payload.facts.environment} - ${payload.facts.passRate}%`;
}
function validateSmtp(recipients: string[]): void {
  if (!recipients.length) throw new Error('MAIL_TO is required when MAIL_MODE=smtp.');
  required('MAIL_FROM');
  required('SMTP_HOST');
  if (process.env.SMTP_USER) required('SMTP_PASS');
}
function required(name: string): string { const value = process.env[name]?.trim(); if (!value) throw new Error(`${name} is required.`); return value; }
function splitAddresses(value?: string): string[] { return (value ?? '').split(/[;,]/).map(item => item.trim()).filter(Boolean); }
function safeFile(value: string): string { return value.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 120); }
function boolEnv(name: string, fallback: boolean): boolean { const value = process.env[name]; return value == null ? fallback : value.toLowerCase() === 'true'; }
function numberEnv(name: string, fallback: number): number { const value = Number(process.env[name] ?? fallback); return Number.isFinite(value) ? value : fallback; }
