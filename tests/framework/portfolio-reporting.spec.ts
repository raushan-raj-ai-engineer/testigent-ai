import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { writePortfolioDashboard, type PortfolioSummaryDocument } from '../../src/framework/reporting/portfolio-dashboard.writer';

/** Author: Raushan Raj */
test.describe('business-friendly portfolio reporting', () => {
  test('renders executive estate health without replacing product drill-down reports', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'testigent-portfolio-report-'));
    try {
      const summary: PortfolioSummaryDocument = {
        generatedAt: '2026-09-12T12:00:00.000Z',
        dryRun: false,
        selection: 'group:customer-a',
        profile: 'regression',
        includeAi: true,
        failFast: false,
        totals: {
          totalProjects: 2,
          passedProjects: 2,
          failedProjects: 0,
          selectedScenarios: 13,
          executedScenarios: 9,
          notApplicable: 4,
          blocked: 0,
          qualityFailed: 1,
          ciBlockingIssues: 0,
          knownDefects: 1,
          healed: 2,
          aiCalls: 1,
        },
        projects: [
          {
            application: 'portal', environment: 'qa', status: 'passed', exitCode: 0,
            selected: 8, executed: 8, qualityFailed: 0, knownDefects: 0, ciBlockingIssues: 0,
            healed: 2, aiCalls: 1, gate: 'PASSED', reportPath: 'reports/portal/business/business-report.json',
          },
          {
            application: 'billing', environment: 'uat', status: 'passed', exitCode: 0,
            selected: 5, executed: 1, notApplicable: 4, qualityFailed: 1, knownDefects: 1,
            ciBlockingIssues: 0, healed: 0, aiCalls: 0, gate: 'PASSED_WITH_ACCEPTED_RISK',
            reportPath: 'reports/billing/business/business-report.json',
          },
        ],
      };
      const output = writePortfolioDashboard(root, summary);
      const html = fs.readFileSync(output, 'utf8');
      expect(html).toContain('PASSED WITH ACCEPTED RISK');
      expect(html).toContain('Quality failures');
      expect(html).toContain('Known defects');
      expect(html).toContain('Validated healing');
      expect(html).toContain('../portal/business/index.html');
      expect(html).toContain('../billing/business/index.html');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
