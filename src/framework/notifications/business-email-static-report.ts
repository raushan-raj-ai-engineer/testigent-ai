import type { BusinessStepDetail, BusinessTestResult, ExecutionFacts } from '../analytics/report.types';

/**
 * Author: Raushan Raj
 * Business Use: Creates a single-file, JavaScript-free business report suitable for email attachment and offline review.
 * How to use: MailNotificationProvider embeds this HTML instead of attaching the interactive dashboard entry file alone.
 * Benefit: Recipients can review KPIs, every test and test.step() detail even when email clients block scripts or external assets.
 */
export function buildStaticBusinessReportHtml(facts: ExecutionFacts): string {
  const rows = facts.results.map(renderResult).join('');
  const impacts = facts.businessImpacts.length
    ? facts.businessImpacts.map(item => `<li><b>${h(item.priority)} · ${h(item.area)}</b> — ${h(item.impact)} (${item.affectedTests})</li>`).join('')
    : '<li>No mapped business impact.</li>';
  const clusters = facts.failureClusters.length
    ? facts.failureClusters.map(item => `<li><b>${item.affectedTests} · ${h(item.category)}</b> — ${h(item.evidence)}</li>`).join('')
    : '<li>No final failure clusters.</li>';

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Automation Business Report</title><style>body{font-family:Arial,sans-serif;margin:0;background:#f8fafc;color:#0f172a}.wrap{max-width:1150px;margin:auto;padding:24px}.hero{background:#0f172a;color:#fff;padding:24px;border-radius:14px}.kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin:16px 0}.kpi,.card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:14px}.kpi b{display:block;font-size:24px;margin-top:5px}.label{font-size:11px;color:#64748b;text-transform:uppercase}.pass{color:#047857}.fail{color:#b91c1c}.skip{color:#64748b}.test{margin:10px 0}.test summary{cursor:pointer;font-weight:700}.meta{color:#64748b;font-size:12px;margin:5px 0}.steps{margin:8px 0 0;padding-left:22px}.step{margin:6px 0}.error{background:#fff1f2;border-left:4px solid #ef4444;padding:8px;white-space:pre-wrap}.evidence{font-size:12px;color:#475569}table{width:100%;border-collapse:collapse}td,th{padding:9px;border-bottom:1px solid #e2e8f0;text-align:left;font-size:13px}@media(max-width:800px){.kpis{grid-template-columns:repeat(2,1fr)}}@media print{body{background:#fff}.wrap{max-width:none;padding:0}details{display:block}details>summary{list-style:none}details[open]>*:not(summary){display:block}}</style></head><body><main class="wrap"><section class="hero"><h1 style="margin:0">Automation Business Report</h1><p>${h(facts.application)} · ${h(facts.environment)} · ${h(facts.runId)}</p><b>${h(facts.qualityGate.status.replaceAll('_',' '))}</b></section><section class="kpis"><div class="kpi"><span class="label">Pass rate</span><b>${facts.passRate}%</b></div><div class="kpi"><span class="label">Passed</span><b class="pass">${facts.passed}</b></div><div class="kpi"><span class="label">Failed</span><b class="fail">${facts.failed}</b></div><div class="kpi"><span class="label">Skipped</span><b class="skip">${facts.skipped}</b></div><div class="kpi"><span class="label">Flaky</span><b>${facts.flakiness.flakyTests}</b></div><div class="kpi"><span class="label">Self-healed</span><b>${facts.healing.count}</b></div></section><section class="card"><h2>Business impact</h2><ul>${impacts}</ul><h2>Failure clusters</h2><ul>${clusters}</ul></section><section class="card" style="margin-top:16px"><h2>Test execution details</h2><p class="meta">Expand any scenario to review exact business test steps. This attachment is intentionally JavaScript-free.</p>${rows || '<p>No business scenarios in this report.</p>'}</section><footer style="text-align:center;color:#94a3b8;font-size:11px;padding:18px">Enterprise Playwright Framework · Author: Raushan Raj</footer></main></body></html>`;
}

function renderResult(result: BusinessTestResult): string {
  const statusClass = result.status === 'passed' ? 'pass' : result.status === 'failed' ? 'fail' : 'skip';
  const steps = result.stepDetails?.length
    ? `<ol class="steps">${result.stepDetails.map(renderStep).join('')}</ol>`
    : result.steps.length ? `<ol class="steps">${result.steps.map(step => `<li>${h(step)}</li>`).join('')}</ol>` : '<p class="meta">No test.step() details captured.</p>';
  const attachments = result.attachments ?? [];
  const evidence = attachments.length ? `<p class="evidence"><b>Evidence:</b> ${attachments.map(item => h(item.name)).join(', ')}</p>` : '';
  return `<details class="test" ${result.status === 'failed' ? 'open' : ''}><summary><span class="${statusClass}">${h(result.status.toUpperCase())}</span> · ${h(result.title)}</summary><div class="meta">${h(result.project)} · ${h(result.testType ?? 'OTHER')} · ${h((result.layers ?? []).join(' + ') || 'Other')} · retries ${result.retriesUsed} · ${result.totalDurationMs} ms</div>${steps}${result.error ? `<div class="error"><b>Failure:</b> ${h(result.error)}</div>` : ''}${evidence}</details>`;
}

function renderStep(step: BusinessStepDetail): string {
  const icon = step.status === 'passed' ? '✓' : step.status === 'failed' ? '✕' : '–';
  const location = step.location?.file ? ` · ${h(step.location.file)}${step.location.line ? `:${step.location.line}` : ''}` : '';
  const children = step.children.length ? `<ol class="steps">${step.children.map(renderStep).join('')}</ol>` : '';
  return `<li class="step"><b>${icon} ${h(step.title)}</b> · ${step.durationMs} ms${location}${step.error ? `<div class="error">${h(step.error)}</div>` : ''}${children}</li>`;
}

function h(value: string): string { return String(value).replace(/[&<>'"]/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char] ?? char)); }
