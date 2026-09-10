import 'dotenv/config';
import { verifySmtpConnection } from '../src/framework/notifications/mail.notification';

/**
 * Author: Raushan Raj
 * Business Use: Validates SMTP host/TLS/authentication without sending any email.
 * How to use: MAIL_MODE=smtp npm run report:mail:check.
 * Benefit: CI and local setup can verify mail connectivity before a real stakeholder notification is attempted.
 */
async function main(): Promise<void> {
  await verifySmtpConnection();
  console.log('SMTP connection/authentication verified successfully. No email was sent.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
