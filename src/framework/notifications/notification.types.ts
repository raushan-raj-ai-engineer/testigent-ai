import type { ExecutionFacts } from '../analytics/report.types';

/**
 * Author: Raushan Raj
 * Business Use: Provider-neutral contract for sending automation release notifications.
 * How to use: Notification providers receive deterministic ExecutionFacts plus report artifact paths.
 * Benefit: SMTP can later be replaced by Microsoft Graph, Gmail API, SES, Teams or Slack without changing reporting logic.
 */
export interface BusinessNotificationPayload {
  facts: ExecutionFacts;
  reportDir: string;
  dashboardPath: string;
  executiveSummaryPath?: string;
  publicReportUrl?: string;
}

export interface BusinessNotificationResult {
  provider: string;
  mode: 'preview' | 'smtp';
  delivered: boolean;
  skipped?: boolean;
  reason?: string;
  messageId?: string;
  previewPath?: string;
  attachmentNames?: string[];
}

export interface BusinessNotificationProvider {
  send(payload: BusinessNotificationPayload): Promise<BusinessNotificationResult>;
}
