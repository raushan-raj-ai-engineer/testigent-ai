import fs from 'node:fs';
import path from 'node:path';

export interface PortfolioProjectFact {
  application: string;
  environment: string;
  status: 'passed' | 'failed' | 'planned';
  exitCode: number;
  reportPath?: string;
  selected?: number;
  executed?: number;
  notApplicable?: number;
  blocked?: number;
  qualityFailed?: number;
  ciBlockingIssues?: number;
  knownDefects?: number;
  healed?: number;
  aiCalls?: number;
  qualityPassRate?: number;
  gate?: string;
}

export interface PortfolioSummaryDocument {
  generatedAt: string;
  dryRun: boolean;
  selection: string;
  profile: string;
  includeAi: boolean;
  failFast: boolean;
  totals: {
    totalProjects: number;
    passedProjects: number;
    failedProjects: number;
    selectedScenarios: number;
    executedScenarios: number;
    notApplicable: number;
    blocked: number;
    qualityFailed: number;
    ciBlockingIssues: number;
    knownDefects: number;
    healed: number;
    aiCalls: number;
  };
  projects: PortfolioProjectFact[];
}

/**
 * Business Use: Produces a lightweight portfolio-level quality view from the same deterministic
 * multi-project summary JSON used by CI.
 * Benefit: Stakeholders see estate health and risk without opening each technical Playwright report.
 */
export function writePortfolioDashboard(reportDirectory: string, summary: PortfolioSummaryDocument): string {
  fs.mkdirSync(reportDirectory, { recursive: true });
  const file = path.join(reportDirectory, 'index.html');
  fs.writeFileSync(file, html(summary), 'utf8');
  return file;
}

function html(summary: PortfolioSummaryDocument): string {
  const status = businessStatus(summary);
  const projectRows = summary.projects.map(project => {
    const reportLink = project.reportPath
      ? `<a href="${escapeHtml(relativeReportHref(project.reportPath))}">Open product report</a>`
      : '<span class="muted">No report</span>';
    return `<tr>
      <td><strong>${escapeHtml(project.application)}</strong><div class="muted">${escapeHtml(project.environment)}</div></td>
      <td><span class="pill ${gateClass(project.gate, project.status)}">${escapeHtml(project.gate ?? project.status.toUpperCase())}</span></td>
      <td>${number(project.selected)}</td>
      <td>${number(project.executed)}</td>
      <td>${number(project.qualityFailed)}</td>
      <td>${number(project.knownDefects)}</td>
      <td>${number(project.ciBlockingIssues)}</td>
      <td>${number(project.healed)}</td>
      <td>${number(project.aiCalls)}</td>
      <td>${reportLink}</td>
    </tr>`;
  }).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>TestigentAI Portfolio Quality</title>
<style>
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#172033;background:#f5f7fb}
*{box-sizing:border-box}body{margin:0}.wrap{max-width:1280px;margin:auto;padding:28px}.hero{background:linear-gradient(135deg,#111827,#243b67);color:white;border-radius:18px;padding:28px;box-shadow:0 10px 35px rgba(15,23,42,.18)}
.hero h1{margin:0 0 6px;font-size:30px}.hero p{margin:6px 0;color:#dbe7ff}.status{display:inline-block;margin-top:14px;padding:8px 12px;border-radius:999px;font-weight:750;background:#fff;color:#15213a}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin:18px 0}.card{background:white;border:1px solid #e5eaf2;border-radius:14px;padding:18px;box-shadow:0 4px 18px rgba(15,23,42,.05)}.card .kpi{font-size:28px;font-weight:800;margin-top:6px}.muted{color:#697386;font-size:12px}.section{background:white;border:1px solid #e5eaf2;border-radius:14px;padding:18px;margin-top:16px;overflow:auto}h2{margin:0 0 14px;font-size:19px}table{border-collapse:collapse;width:100%;min-width:980px}th,td{text-align:left;padding:12px;border-bottom:1px solid #edf0f5;font-size:13px}th{color:#5b6473;font-size:12px;text-transform:uppercase;letter-spacing:.04em}.pill{display:inline-block;padding:5px 9px;border-radius:999px;font-size:11px;font-weight:800}.pass{background:#e8f7ee;color:#176b3a}.risk{background:#fff4dd;color:#8a5a00}.fail{background:#fdeaea;color:#a32626}.planned{background:#eaf1ff;color:#315f9c}a{color:#2457b2;text-decoration:none;font-weight:650}.foot{margin:18px 2px;color:#7a8495;font-size:12px}
</style>
</head>
<body><main class="wrap">
<section class="hero">
  <h1>TestigentAI Portfolio Quality</h1>
  <p>${escapeHtml(summary.selection)} · profile ${escapeHtml(summary.profile)} · ${summary.projects.length} product${summary.projects.length === 1 ? '' : 's'}</p>
  <span class="status">${escapeHtml(status)}</span>
</section>
<section class="grid">
  ${card('Products', summary.totals.totalProjects, `${summary.totals.passedProjects} completed without CI failure`)}
  ${card('Business scenarios', summary.totals.selectedScenarios, `${summary.totals.executedScenarios} executed`)}
  ${card('Quality failures', summary.totals.qualityFailed, `${summary.totals.knownDefects} accepted known defect${summary.totals.knownDefects === 1 ? '' : 's'}`)}
  ${card('CI blockers', summary.totals.ciBlockingIssues, 'Unexpected failures / stale expectations')}
  ${card('Not applicable', summary.totals.notApplicable, `${summary.totals.blocked} blocked`)}
  ${card('Validated healing', summary.totals.healed, `${summary.totals.aiCalls} AI call${summary.totals.aiCalls === 1 ? '' : 's'}`)}
</section>
<section class="section"><h2>Product quality view</h2>
<table><thead><tr><th>Product</th><th>Quality gate</th><th>Selected</th><th>Executed</th><th>Quality failed</th><th>Known defects</th><th>CI blockers</th><th>Healed</th><th>AI calls</th><th>Drill-down</th></tr></thead><tbody>${projectRows}</tbody></table>
</section>
<section class="section"><h2>How to read this report</h2><p><strong>PASSED</strong> means no stakeholder quality failures. <strong>PASSED WITH ACCEPTED RISK</strong> means known defects remain quality failures but are explicitly non-blocking. <strong>ATTENTION REQUIRED</strong> means an unexpected failure or stale expectation requires action.</p><p class="muted">Technical traces, screenshots, API evidence and step-level details remain in each product report.</p></section>
<div class="foot">Generated ${escapeHtml(summary.generatedAt)} · AI included: ${summary.includeAi ? 'yes' : 'no'} · fail-fast: ${summary.failFast ? 'yes' : 'no'}</div>
</main></body></html>`;
}

function card(label: string, value: number, note: string): string {
  return `<div class="card"><div class="muted">${escapeHtml(label)}</div><div class="kpi">${value}</div><div class="muted">${escapeHtml(note)}</div></div>`;
}

function businessStatus(summary: PortfolioSummaryDocument): string {
  if (summary.dryRun) return 'PLANNED';
  if (summary.totals.failedProjects > 0 || summary.totals.ciBlockingIssues > 0) return 'ATTENTION REQUIRED';
  if (summary.totals.qualityFailed > 0) return 'PASSED WITH ACCEPTED RISK';
  return 'PASSED';
}

function gateClass(gate: string | undefined, status: PortfolioProjectFact['status']): string {
  const value = gate ?? status;
  if (/ATTENTION|FAILED/i.test(value)) return 'fail';
  if (/RISK|KNOWN/i.test(value)) return 'risk';
  if (/PLANNED/i.test(value)) return 'planned';
  return 'pass';
}

function relativeReportHref(reportPath: string): string {
  const normalized = reportPath.replace(/\\/g, '/');
  const businessJson = normalized.endsWith('/business-report.json') ? normalized.slice(0, -'/business-report.json'.length) : normalized;
  // Portfolio dashboard lives under reports/multi-project/, so product report is one level up.
  const marker = 'reports/';
  const index = businessJson.indexOf(marker);
  const reportRelative = index >= 0 ? businessJson.slice(index + marker.length) : businessJson;
  return `../${reportRelative}/index.html`;
}

function number(value: number | undefined): string { return String(value ?? 0); }
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}
