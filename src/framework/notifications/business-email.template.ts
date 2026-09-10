import type { ExecutionFacts } from '../analytics/report.types';

/**
 * Author: Raushan Raj
 * Business Use: Builds a compact stakeholder email from deterministic execution facts.
 * How to use: Pass ExecutionFacts and the optional published dashboard URL.
 * Benefit: Business users can decide whether a release needs attention before opening the detailed dashboard.
 */
export function buildBusinessEmailHtml(facts: ExecutionFacts, publicReportUrl?: string): string {
  const passed = facts.qualityGate.status === 'PASSED';
  const gateLabel = passed ? 'RELEASE GATE PASSED' : 'ATTENTION REQUIRED';
  const gateColor = passed ? '#047857' : '#b91c1c';
  const gateBackground = passed ? '#d1fae5' : '#fee2e2';
  const scope = facts.scope
    ? `<p style="margin:8px 0 0;color:#64748b;font-size:12px">Business scope: ${facts.scope.includedTests} included · ${facts.scope.excludedInternalTests} framework/internal checks excluded.</p>`
    : '';
  const action = publicReportUrl
    ? `<a href="${escapeHtml(publicReportUrl)}" style="display:inline-block;background:#1d4ed8;color:white;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700">Open interactive dashboard</a>`
    : '<p style="color:#64748b;font-size:13px;margin:0">A self-contained static report is attached. Configure REPORT_PUBLIC_URL to include a link to the fully interactive dashboard.</p>';
  const impacts = facts.businessImpacts.length
    ? `<ul style="padding-left:20px">${facts.businessImpacts.slice(0, 5).map(item => `<li style="margin:6px 0"><b>${escapeHtml(item.priority)}</b> · ${escapeHtml(item.area)} — ${escapeHtml(item.impact)} (${item.affectedTests} scenario${item.affectedTests === 1 ? '' : 's'})</li>`).join('')}</ul>`
    : '<p style="color:#64748b">No configured business-impact rule matched a final failed scenario.</p>';
  const clusters = facts.failureClusters.length
    ? `<ul style="padding-left:20px">${facts.failureClusters.slice(0, 5).map(item => `<li style="margin:6px 0"><b>${item.affectedTests} test(s)</b> · ${escapeHtml(item.category)} — ${escapeHtml(item.evidence)}</li>`).join('')}</ul>`
    : '<p style="color:#64748b">No final failure clusters.</p>';
  const aiUsage = facts.aiUsage;
  const aiProviders = aiUsage?.providers?.length ? aiUsage.providers.map(item => `${item.provider}${item.models.length ? `/${item.models.join('+')}` : ''}`).join(', ') : 'none';
  const failedTests = facts.results.filter(item => item.status === 'failed').slice(0, 5);
  const failures = failedTests.length
    ? `<table role="presentation" width="100%" style="border-collapse:collapse">${failedTests.map(item => `<tr><td style="padding:8px;border-bottom:1px solid #e2e8f0"><b>${escapeHtml(item.title)}</b><div style="font-size:12px;color:#64748b">${escapeHtml(item.project)} · ${escapeHtml(item.testType ?? 'OTHER')} · ${escapeHtml(item.failureCategory ?? 'UNCLASSIFIED')}</div></td></tr>`).join('')}</table>`
    : '<p style="color:#64748b">No final failed business scenarios.</p>';

  return `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a"><div style="max-width:780px;margin:0 auto;padding:24px"><div style="background:#0f172a;color:white;padding:24px;border-radius:14px"><h1 style="margin:0;font-size:24px">Automation Release Summary</h1><p style="margin:8px 0 0;color:#cbd5e1">${escapeHtml(facts.application)} · ${escapeHtml(facts.environment)} · ${escapeHtml(facts.runId)}</p></div><div style="background:white;border:1px solid #e2e8f0;border-radius:14px;padding:20px;margin-top:14px"><span style="display:inline-block;background:${gateBackground};color:${gateColor};padding:8px 12px;border-radius:999px;font-weight:800">${gateLabel}</span>${scope}<table role="presentation" width="100%" style="margin-top:16px;border-collapse:collapse"><tr>${metric('Pass rate', `${facts.passRate}%`)}${metric('Passed', facts.passed)}${metric('Failed', facts.failed)}${metric('Skipped', facts.skipped)}</tr><tr>${metric('Flaky', facts.flakiness.flakyTests)}${metric('Self-healed', facts.healing.count)}${metric('AI healing', facts.healing.ai)}${metric('AI calls', aiUsage?.calls ?? 0)}${metric('AI provider/model', aiProviders)}${metric('UI / API / DB', `${facts.layerCounts.UI} / ${facts.layerCounts.API} / ${facts.layerCounts.DATABASE}`)}</tr></table><h2 style="font-size:16px;margin-top:22px">Top failed scenarios</h2>${failures}<h2 style="font-size:16px;margin-top:22px">Business impact</h2>${impacts}<h2 style="font-size:16px">Failure clusters</h2>${clusters}<div style="margin-top:22px">${action}</div><p style="font-size:12px;color:#64748b;margin-top:20px">Pass rate, statuses, retries, healing and failure clusters are deterministic framework facts. AI may explain evidence but cannot override these values.</p></div><div style="font-size:11px;color:#94a3b8;text-align:center;padding:16px">Enterprise Playwright Framework · Author: Raushan Raj</div></div></body></html>`;
}

/** Author: Raushan Raj */
export function buildBusinessEmailText(facts: ExecutionFacts, publicReportUrl?: string): string {
  const lines = [
    'AUTOMATION RELEASE SUMMARY',
    `${facts.application} | ${facts.environment} | ${facts.runId}`,
    `Quality gate: ${facts.qualityGate.status.replaceAll('_', ' ')}`,
    `Pass rate: ${facts.passRate}%`,
    `Passed: ${facts.passed} | Failed: ${facts.failed} | Skipped: ${facts.skipped}`,
    `Flaky: ${facts.flakiness.flakyTests} | Self-healed: ${facts.healing.count} | AI healing: ${facts.healing.ai}`,
    `AI runtime: ${(facts.aiUsage?.calls ?? 0)} call(s) | Providers: ${facts.aiUsage?.providers?.map(item => `${item.provider}${item.models.length ? `/${item.models.join('+')}` : ''}`).join(', ') || 'none'}`, 
    `UI/API/DB: ${facts.layerCounts.UI}/${facts.layerCounts.API}/${facts.layerCounts.DATABASE}`
  ];
  if (facts.failureClusters.length) lines.push('', 'Top failure clusters:', ...facts.failureClusters.slice(0, 5).map(item => `- ${item.affectedTests} test(s): ${item.category} - ${item.evidence}`));
  if (publicReportUrl) lines.push('', `Interactive dashboard: ${publicReportUrl}`);
  else lines.push('', 'A self-contained static business report is attached.');
  return lines.join('\n');
}

function metric(label: string, value: string | number): string {
  return `<td style="padding:10px;border:1px solid #e2e8f0"><div style="font-size:11px;color:#64748b;text-transform:uppercase">${escapeHtml(label)}</div><div style="font-size:22px;font-weight:800;margin-top:4px">${escapeHtml(String(value))}</div></td>`;
}
function escapeHtml(value: string): string { return String(value).replace(/[&<>'"]/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char] ?? char)); }
