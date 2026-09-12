import fs from 'node:fs';
import path from 'node:path';
import type { ExecutionFacts } from '../src/framework/analytics/report.types';
import { ProjectPaths } from '../src/framework/core/config/project.paths';

/**
 * Author: Raushan Raj
 * Business Use: Renders a resilient GitHub Actions step summary for the final merged business report.
 * How to use: Run `npm run ci:business:summary` and append stdout to `$GITHUB_STEP_SUMMARY`.
 * Benefit: Avoids fragile shell heredocs and keeps summary publication informational when an earlier merge gate already failed.
 */
export function formatBusinessStepSummary(facts: ExecutionFacts): string {
  const sourceReports = facts.aggregation?.sourceReports ?? 1;
  const coreReports = facts.aggregation?.coreReports ?? sourceReports;
  const aiReports = facts.aggregation?.aiReports ?? 0;
  const aiResults = facts.aggregation?.aiResults ?? facts.results.filter(result => result.tags.includes('@ai')).length;
  return [
    '## TestigentAI merged quality report',
    `- Selected: **${facts.total}**`,
    `- Applicable: **${facts.executionEligible}**`,
    `- Executed: **${facts.executed}/${facts.executionEligible} (${facts.executionRate}%)**`,
    `- Quality failed: **${facts.qualityFailed}** (known ${facts.knownDefects}, unexpected ${facts.unexpectedFailed})`,
    `- CI-blocking issues: **${facts.ciBlockingIssues}**`,
    `- Self-healed: **${facts.healing?.count ?? 0}** · AI calls: **${facts.aiUsage?.calls ?? 0}**`,
    `- AI-specific results: **${aiResults}**`,
    `- Aggregated bundles: **${sourceReports}** (core ${coreReports}, AI ${aiReports})`
  ].join('\n');
}

/**
 * Author: Raushan Raj
 * Business Use: Produces a non-blocking diagnostic summary when the canonical merged report is unavailable.
 * How to use: Called by the GitHub step-summary CLI when an earlier merge/finalization/validation step failed.
 * Benefit: Preserves the original CI failure as the root cause instead of replacing it with a secondary summary error.
 */
export function renderBusinessStepSummary(reportFile?: string): string {
  const app = process.env.APP?.trim() || 'unknown-app';
  const resolved = path.resolve(reportFile ?? process.env.FINAL_BUSINESS_REPORT_DIR ?? path.join(ProjectPaths.businessReport(app), 'business-report.json'));
  if (!fs.existsSync(resolved)) {
    return [
      '## TestigentAI merged quality report',
      '- Status: **Unavailable**',
      `- Reason: merged business report was not created at \`${resolved}\`.`,
      '- Check the earlier merge/finalization/validation step for the root failure.'
    ].join('\n');
  }

  try {
    const facts = JSON.parse(fs.readFileSync(resolved, 'utf8')) as ExecutionFacts;
    return formatBusinessStepSummary(facts);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return [
      '## TestigentAI merged quality report',
      '- Status: **Unavailable**',
      `- Reason: business-report.json could not be parsed (${escapeMarkdown(message)}).`,
      '- Check the earlier business-bundle validation step for the root failure.'
    ].join('\n');
  }
}

function escapeMarkdown(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').replace(/`/g, "'").trim();
}

function main(): void {
  console.log(renderBusinessStepSummary());
}

if (require.main === module) main();
