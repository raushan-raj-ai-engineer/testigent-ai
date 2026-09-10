/**
 * GENERATED PROPOSAL - REVIEW_REQUIRED
 * Requirement: payment
 * Do not merge before human review.
 * Author: Raushan Raj
 */
import type { PaymentPage } from '../pages/payment.page.js';

export class PaymentWorkflow {
  constructor(private readonly featurePage: PaymentPage) {}
  async execute(): Promise<void> { await this.featurePage.performPrimaryAction(); }
}
