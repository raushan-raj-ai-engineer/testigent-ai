import type { ExecutionFacts } from '../analytics/report.types';

/**
 * Author: Raushan Raj
 * Business Use: Builds a compact stakeholder email from deterministic execution facts.
 * How to use: Pass ExecutionFacts and the optional published dashboard URL.
 * Benefit: Business users can distinguish new failures, accepted known-defect debt and CI-blocking issues before opening the dashboard.
 */
export function buildBusinessEmailHtml(facts: ExecutionFacts, publicReportUrl?: string): string {
  const gate = gateView(facts.qualityGate.status);
  const scope = facts.scope
    ? `<p style="margin:8px 0 0;color:#64748b;font-size:12px">Business scope: ${facts.total} selected · ${facts.executionEligible} applicable · ${facts.executed} executed · ${facts.notApplicable} not applicable · ${facts.blockedSkipped} blocked · ${facts.scope.excludedInternalTests} framework/internal checks excluded.</p>`
    : '';
  const action = publicReportUrl
    ? `<a href="${escapeHtml(publicReportUrl)}" style="display:inline-block;background:#1d4ed8;color:white;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700">Open interactive dashboard</a>`
    : '<p style="color:#64748b;font-size:13px;margin:0">A self-contained static report is attached. Configure REPORT_PUBLIC_URL to include a link to the interactive dashboard.</p>';
  const actionItems = facts.results.filter(item => item.ciBlocking).slice(0, 5);
  const actionList = actionItems.length
    ? `<table role="presentation" width="100%" style="border-collapse:collapse">${actionItems.map(item => `<tr><td style="padding:8px;border-bottom:1px solid #e2e8f0"><b>${escapeHtml(item.title)}</b><div style="font-size:12px;color:#64748b">${escapeHtml(item.outcome ?? 'FAILED')} · ${escapeHtml(item.project)} · ${escapeHtml(item.failureCategory ?? 'UNCLASSIFIED')}</div></td></tr>`).join('')}</table>`
    : '<p style="color:#64748b">No CI-blocking scenario requires investigation.</p>';
  const known = facts.results.filter(item => item.outcome === 'KNOWN_DEFECT').slice(0, 5);
  const knownList = known.length
    ? `<ul style="padding-left:20px">${known.map(item => `<li style="margin:6px 0"><b>${escapeHtml(item.knownDefect?.id ?? 'KNOWN')}</b> · ${escapeHtml(item.knownDefect?.title ?? item.title)} — ${escapeHtml(item.knownDefect?.scope ?? item.title)}</li>`).join('')}</ul>`
    : '<p style="color:#64748b">No registered known-defect debt in this run.</p>';
  const impacts = facts.businessImpacts.length
    ? `<ul style="padding-left:20px">${facts.businessImpacts.slice(0, 5).map(item => `<li style="margin:6px 0"><b>${escapeHtml(item.priority)}</b> · ${escapeHtml(item.area)} — ${escapeHtml(item.impact)} (${item.affectedTests})</li>`).join('')}</ul>`
    : '<p style="color:#64748b">No configured business-impact rule matched a quality-failed scenario.</p>';

  return `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a"><div style="max-width:820px;margin:0 auto;padding:24px"><div style="background:#0f172a;color:white;padding:24px;border-radius:14px"><h1 style="margin:0;font-size:24px">Automation Release Summary</h1><p style="margin:8px 0 0;color:#cbd5e1">${escapeHtml(facts.application)} · ${escapeHtml(facts.environment)} · ${escapeHtml(facts.runId)}</p></div><div style="background:white;border:1px solid #e2e8f0;border-radius:14px;padding:20px;margin-top:14px"><span style="display:inline-block;background:${gate.bg};color:${gate.color};padding:8px 12px;border-radius:999px;font-weight:800">${gate.label}</span>${scope}<table role="presentation" width="100%" style="margin-top:16px;border-collapse:collapse"><tr>${metric('Selected', facts.total)}${metric('Executed', `${facts.executed}/${facts.executionEligible}`)}${metric('Execution coverage', `${facts.executionRate}%`)}${metric('Not applicable', facts.notApplicable)}</tr><tr>${metric('Quality pass rate', `${facts.qualityPassRate}%`)}${metric('Quality failed', facts.qualityFailed)}${metric('Known defects', facts.knownDefects)}${metric('CI blocking', facts.ciBlockingIssues)}</tr></table><h2 style="font-size:16px;margin-top:22px">Action required</h2>${actionList}<h2 style="font-size:16px;margin-top:22px">Known defects / accepted debt</h2>${knownList}<h2 style="font-size:16px;margin-top:22px">Business impact</h2>${impacts}<div style="margin-top:22px">${action}</div><p style="font-size:12px;color:#64748b;margin-top:20px">Known defects count as quality failures but remain non-blocking only when explicitly registered. Unexpected failures and unexpected passes are CI-blocking signals. Quality facts are deterministic; AI cannot override them.</p></div><div style="font-size:11px;color:#94a3b8;text-align:center;padding:16px">TestigentAI · Intelligent Quality Engineering Platform · Author: Raushan Raj</div></div></body></html>`;
}

/** Author: Raushan Raj */
export function buildBusinessEmailText(facts: ExecutionFacts, publicReportUrl?: string): string {
  const lines = [
    'AUTOMATION RELEASE SUMMARY',
    `${facts.application} | ${facts.environment} | ${facts.runId}`,
    `Release decision: ${facts.qualityGate.status.replaceAll('_', ' ')}`,
    `Quality pass rate: ${facts.qualityPassRate}%`,
    `Quality failed: ${facts.qualityFailed} | Known defects: ${facts.knownDefects} | Unexpected failed: ${facts.unexpectedFailed}`,
    `Selected: ${facts.total} | Applicable: ${facts.executionEligible} | Executed: ${facts.executed} | Not applicable: ${facts.notApplicable} | Blocked: ${facts.blockedSkipped}`,
    `Execution coverage: ${facts.executionRate}% | CI-blocking issues: ${facts.ciBlockingIssues} | Unexpected pass: ${facts.unexpectedPass}`,
    `Flaky: ${facts.flakiness.flakyTests} | Self-healed: ${facts.healing.count}`,
    `UI/API/DB: ${facts.layerCounts.UI}/${facts.layerCounts.API}/${facts.layerCounts.DATABASE}`
  ];
  const known = facts.results.filter(item => item.outcome === 'KNOWN_DEFECT');
  if (known.length) lines.push('', 'Known defects:', ...known.slice(0, 5).map(item => `- ${item.knownDefect?.id ?? 'KNOWN'}: ${item.knownDefect?.title ?? item.title}`));
  const blockers = facts.results.filter(item => item.ciBlocking);
  if (blockers.length) lines.push('', 'Action required:', ...blockers.slice(0, 5).map(item => `- ${item.outcome}: ${item.title}`));
  if (publicReportUrl) lines.push('', `Interactive dashboard: ${publicReportUrl}`);
  else lines.push('', 'A self-contained static business report is attached.');
  return lines.join('\n');
}

function gateView(status: ExecutionFacts['qualityGate']['status']): { label: string; color: string; bg: string } {
  if (status === 'PASSED') return { label: 'RELEASE GATE PASSED', color: '#047857', bg: '#d1fae5' };
  if (status === 'PASSED_WITH_ACCEPTED_RISK') return { label: 'PASSED WITH ACCEPTED RISK', color: '#92400e', bg: '#fef3c7' };
  return { label: 'ATTENTION REQUIRED', color: '#b91c1c', bg: '#fee2e2' };
}
function metric(label: string, value: string | number): string { return `<td style="padding:10px;border:1px solid #e2e8f0"><div style="font-size:11px;color:#64748b;text-transform:uppercase">${escapeHtml(label)}</div><div style="font-size:22px;font-weight:800;margin-top:4px">${escapeHtml(String(value))}</div></td>`; }
function escapeHtml(value: string): string { return String(value).replace(/[&<>'"]/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char] ?? char)); }
