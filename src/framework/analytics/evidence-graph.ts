import type { BusinessOutcome, BusinessTestResult, ExecutionFacts } from './report.types';

export type EvidenceClaimStatus = 'SUPPORTED' | 'ATTENTION' | 'INCOMPLETE';

export interface EvidenceClaim {
  id: string;
  label: string;
  value: string;
  status: EvidenceClaimStatus;
  explanation: string;
  formula?: string;
  sourceFields: string[];
  testIds: string[];
}

export interface EvidenceNode {
  id: string;
  type: 'run' | 'claim' | 'requirement' | 'scenario' | 'source' | 'attachment' | 'defect' | 'healing' | 'ai';
  label: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface EvidenceEdge {
  from: string;
  to: string;
  relation: 'supports' | 'derived-from' | 'implements' | 'evidenced-by' | 'healed-by' | 'affected-by';
}

export interface EvidenceGraph {
  schemaVersion: 1;
  generatedAt: string;
  runId: string;
  application: string;
  environment: string;
  claims: EvidenceClaim[];
  nodes: EvidenceNode[];
  edges: EvidenceEdge[];
  traceability: {
    scenarios: number;
    traceableScenarios: number;
    completeness: number;
    requirements: number;
    attachments: number;
  };
}

export interface ExplainableReleaseRisk {
  level: 'UNKNOWN' | 'LOW' | 'MEDIUM' | 'HIGH';
  evidenceConfidence: 'COMPLETE' | 'PARTIAL';
  factors: string[];
}

/** Deterministic, score-free release risk derived from named quality signals. */
export function deriveExplainableReleaseRisk(facts: ExecutionFacts): ExplainableReleaseRisk {
  if (facts.total === 0) {
    return {
      level: 'UNKNOWN',
      evidenceConfidence: 'PARTIAL',
      factors: ['No reported scenarios are available; release risk cannot be inferred from absent execution evidence.']
    };
  }

  const factors: string[] = [];
  if (facts.ciBlockingIssues > 0) factors.push(`${facts.ciBlockingIssues} CI-blocking issue(s)`);
  if (facts.blockedSkipped > 0) factors.push(`${facts.blockedSkipped} applicable scenario(s) blocked`);
  if (facts.knownDefects > 0) factors.push(`${facts.knownDefects} accepted known defect(s)`);
  if (facts.flakiness.flakyTests > 0) factors.push(`${facts.flakiness.flakyTests} flaky/retry-recovered scenario(s)`);
  if ((facts.healing.rejected ?? 0) > 0) factors.push(`${facts.healing.rejected} rejected healing attempt(s)`);
  if ((facts.healing.unverified ?? 0) > 0) factors.push(`${facts.healing.unverified} unverified healing attempt(s)`);
  if (facts.executionEligible > 0 && facts.executionRate < 100) factors.push(`applicable execution coverage ${facts.executionRate}%`);

  const traceable = facts.results.filter(result => result.testId && result.sourceFile && result.attempts.length > 0).length;
  const traceability = facts.results.length ? Number(((traceable / facts.results.length) * 100).toFixed(2)) : 0;
  const evidenceConfidence: ExplainableReleaseRisk['evidenceConfidence'] = traceability === 100 && facts.executionEligible > 0 && facts.executionRate === 100 ? 'COMPLETE' : 'PARTIAL';
  const level: ExplainableReleaseRisk['level'] = facts.ciBlockingIssues > 0 || facts.qualityGate.status === 'ATTENTION_REQUIRED'
    ? 'HIGH'
    : facts.knownDefects > 0 || facts.flakiness.flakyTests > 0 || (facts.healing.rejected ?? 0) > 0 || (facts.healing.unverified ?? 0) > 0
      ? 'MEDIUM'
      : 'LOW';
  return { level, evidenceConfidence, factors: factors.length ? factors : ['No configured release-risk signal requires attention.'] };
}

/**
 * Author: Raushan Raj
 * Business Use: Builds a deterministic provenance graph behind every business-report claim.
 * How to use: Call buildEvidenceGraph() with final ExecutionFacts, then publish the JSON/ledger beside the dashboard.
 * Benefit: Stakeholders can verify release claims without trusting opaque AI narration or manually correlating raw files.
 */
export function buildEvidenceGraph(facts: ExecutionFacts): EvidenceGraph {
  const nodes: EvidenceNode[] = [{
    id: `run:${facts.runId}`,
    type: 'run',
    label: `${facts.application}/${facts.environment} · ${facts.runId}`,
    metadata: { generatedAt: facts.generatedAt }
  }];
  const nodeIds = new Set<string>(nodes.map(node => node.id));
  const edges: EvidenceEdge[] = [];
  const requirements = new Set<string>();
  let attachmentCount = 0;
  let traceable = 0;

  for (const result of facts.results) {
    const scenarioId = scenarioNodeId(result.testId);
    const outcome = result.outcome ?? legacyOutcome(result.status);
    addNode(nodes, nodeIds, {
      id: scenarioId,
      type: 'scenario',
      label: result.title,
      metadata: {
        testId: result.testId,
        outcome,
        project: result.project,
        sourceFile: result.sourceFile ?? '',
        ciBlocking: Boolean(result.ciBlocking)
      }
    });
    edges.push({ from: scenarioId, to: `run:${facts.runId}`, relation: 'derived-from' });

    if (result.testId && result.sourceFile && result.attempts.length > 0) traceable += 1;

    if (result.sourceFile) {
      const sourceId = `source:${normalizeId(result.sourceFile)}`;
      addNode(nodes, nodeIds, { id: sourceId, type: 'source', label: result.sourceFile });
      edges.push({ from: scenarioId, to: sourceId, relation: 'derived-from' });
    }

    for (const requirement of requirementIds(result.tags)) {
      requirements.add(requirement);
      const requirementId = `requirement:${normalizeId(requirement)}`;
      addNode(nodes, nodeIds, { id: requirementId, type: 'requirement', label: requirement });
      edges.push({ from: scenarioId, to: requirementId, relation: 'implements' });
    }

    for (const attachment of result.attachments ?? []) {
      if (!attachment.reportPath) continue;
      attachmentCount += 1;
      const attachmentId = `attachment:${normalizeId(`${result.testId}:${attachment.reportPath}`)}`;
      addNode(nodes, nodeIds, {
        id: attachmentId,
        type: 'attachment',
        label: attachment.name,
        metadata: { contentType: attachment.contentType, reportPath: attachment.reportPath }
      });
      edges.push({ from: scenarioId, to: attachmentId, relation: 'evidenced-by' });
    }

    if (result.knownDefect) {
      const defectId = `defect:${normalizeId(result.knownDefect.id)}`;
      addNode(nodes, nodeIds, { id: defectId, type: 'defect', label: `${result.knownDefect.id} · ${result.knownDefect.title}` });
      edges.push({ from: scenarioId, to: defectId, relation: 'affected-by' });
    }
  }

  for (const [index, record] of facts.healing.records.entries()) {
    const healingId = `healing:${index + 1}:${normalizeId(record.planId)}`;
    nodes.push({
      id: healingId,
      type: 'healing',
      label: record.businessName,
      metadata: { source: record.decision.source, confidence: record.decision.confidence, outcome: record.outcome ?? 'validated' }
    });
    if (record.testId) {
      const scenarioId = scenarioNodeId(record.testId);
      if (nodeIds.has(scenarioId)) edges.push({ from: scenarioId, to: healingId, relation: 'healed-by' });
    }
  }

  for (const [index, record] of (facts.aiUsage?.records ?? []).entries()) {
    const aiId = `ai:${index + 1}`;
    nodes.push({
      id: aiId,
      type: 'ai',
      label: `${record.purpose} · ${record.status}`,
      metadata: { provider: record.provider ?? '', model: record.model ?? '', latencyMs: record.latencyMs ?? 0 }
    });
    if (record.testId) {
      const scenarioId = scenarioNodeId(record.testId);
      if (nodeIds.has(scenarioId)) edges.push({ from: scenarioId, to: aiId, relation: 'evidenced-by' });
    }
  }

  const completeness = facts.results.length ? Number(((traceable / facts.results.length) * 100).toFixed(2)) : 0;
  const claims = buildClaims(facts, completeness);
  for (const claim of claims) {
    const claimId = claimNodeId(claim.id);
    nodes.push({ id: claimId, type: 'claim', label: claim.label, metadata: { value: claim.value, status: claim.status } });
    edges.push({ from: claimId, to: `run:${facts.runId}`, relation: 'derived-from' });
    for (const testId of claim.testIds) {
      const scenarioId = scenarioNodeId(testId);
      if (nodeIds.has(scenarioId)) edges.push({ from: claimId, to: scenarioId, relation: 'supports' });
    }
  }

  return {
    schemaVersion: 1,
    generatedAt: facts.generatedAt,
    runId: facts.runId,
    application: facts.application,
    environment: facts.environment,
    claims,
    nodes,
    edges,
    traceability: {
      scenarios: facts.results.length,
      traceableScenarios: traceable,
      completeness,
      requirements: requirements.size,
      attachments: attachmentCount
    }
  };
}

/** Renders a deliberately simple, audit-first view separate from the executive dashboard. */
export function renderEvidenceLedgerHtml(graph: EvidenceGraph, facts: ExecutionFacts): string {
  const scenarioById = new Map(facts.results.map(result => [result.testId, result]));
  const claims = graph.claims.map(claim => {
    const scenarios = claim.testIds.map(testId => scenarioById.get(testId)).filter((value): value is BusinessTestResult => Boolean(value));
    const scenarioRows = scenarios.length
      ? scenarios.map(result => {
        const attachments = (result.attachments ?? []).map(attachment => {
          const href = safeEvidenceHref(attachment.reportPath);
          return href ? `<a class="attachment" href="${escapeAttr(href)}">${escapeHtml(attachment.name)}</a>` : '';
        }).filter(Boolean).join(' · ');
        return `<li><a href="./index.html#searchFilter=${encodeURIComponent(result.title)}">${escapeHtml(result.title)}</a><span>${escapeHtml(result.sourceFile ?? 'source unavailable')} · ${escapeHtml(result.outcome ?? legacyOutcome(result.status))}</span>${attachments ? `<span>Evidence: ${attachments}</span>` : '<span>No materialized attachment for this scenario.</span>'}</li>`;
      }).join('')
      : '<li class="muted">This claim is derived from run-level counters rather than a scenario subset.</li>';
    return `<section class="claim" id="claim-${escapeAttr(claim.id)}"><div class="claim-head"><div><div class="eyebrow">${escapeHtml(claim.status)}</div><h2>${escapeHtml(claim.label)}</h2></div><strong>${escapeHtml(claim.value)}</strong></div><p>${escapeHtml(claim.explanation)}</p>${claim.formula ? `<div class="formula"><b>Calculation</b><code>${escapeHtml(claim.formula)}</code></div>` : ''}<details><summary>Show supporting facts</summary><div class="facts"><div><b>Source fields</b><br>${claim.sourceFields.map(escapeHtml).join('<br>')}</div><div><b>Scenario evidence</b><ul>${scenarioRows}</ul></div></div></details></section>`;
  }).join('');

  const requirements = graph.nodes.filter(node => node.type === 'requirement').map(node => node.label).sort();
  const requirementSection = requirements.length
    ? `<section class="claim"><div class="eyebrow">EXPLICIT TRACEABILITY</div><h2>Requirements in reported scope</h2><p>${requirements.map(escapeHtml).join(' · ')}</p></section>`
    : `<section class="claim"><div class="eyebrow">EXPLICIT TRACEABILITY</div><h2>Requirements in reported scope</h2><p class="muted">No explicit @requirement:&lt;id&gt; tag was captured for this reported scope. TestigentAI does not invent requirement mappings.</p></section>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TestigentAI Evidence Ledger</title><style>
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#172033;background:#f5f7fb}*{box-sizing:border-box}body{margin:0}.wrap{max-width:1100px;margin:auto;padding:26px}.hero{background:#111827;color:#fff;border-radius:18px;padding:24px}.hero h1{margin:4px 0 8px}.hero p{margin:0;color:#cbd5e1;line-height:1.5}.meta{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.meta span{background:#ffffff18;padding:6px 9px;border-radius:999px;font-size:11px}.toolbar{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:18px 0}.button{display:inline-block;text-decoration:none;background:#fff;border:1px solid #cbd5e1;color:#172033;padding:9px 12px;border-radius:9px;font-weight:700;font-size:12px}.claim{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:18px;margin:12px 0;box-shadow:0 4px 16px #0f172a0a}.claim-head{display:flex;justify-content:space-between;gap:16px}.claim h2{margin:3px 0;font-size:17px}.claim strong{font-size:22px}.claim p{color:#475569;line-height:1.5}.eyebrow{font-size:10px;letter-spacing:.08em;color:#64748b;font-weight:800}.formula{background:#f8fafc;padding:10px;border-radius:9px;margin:10px 0}.formula code{display:block;margin-top:5px;white-space:pre-wrap}.facts{display:grid;grid-template-columns:1fr 2fr;gap:18px;padding-top:12px}.facts ul{margin:6px 0;padding-left:18px}.facts li{margin:8px 0}.facts li span{display:block;color:#64748b;font-size:11px}.facts .attachment{font-size:11px}.muted{color:#64748b}.trust{background:#eff6ff;border-left:4px solid #2563eb;padding:12px;border-radius:8px;margin-top:16px;font-size:12px;line-height:1.5}@media(max-width:720px){.facts{grid-template-columns:1fr}.claim-head{flex-direction:column}.toolbar{align-items:flex-start;flex-direction:column}}
</style></head><body><main class="wrap"><section class="hero"><div class="eyebrow">TESTIGENTAI · CLAIM PROVENANCE</div><h1>Evidence Ledger</h1><p>Every value below is generated from the same deterministic execution facts as the business dashboard. This page is intentionally audit-first and does not use AI to calculate release claims.</p><div class="meta"><span>Run ${escapeHtml(graph.runId)}</span><span>${escapeHtml(graph.application)}/${escapeHtml(graph.environment)}</span><span>Traceability ${graph.traceability.completeness}%</span><span>${graph.traceability.requirements} requirement link(s)</span><span>${graph.traceability.attachments} materialized attachment(s)</span></div></section><div class="toolbar"><a class="button" href="./index.html">← Back to dashboard</a><a class="button" href="./evidence-graph.json" download>Download evidence graph JSON</a></div>${requirementSection}${claims}<div class="trust"><b>Truth boundary:</b> this ledger proves how TestigentAI calculated the displayed claims from captured execution facts. It does not prove customer value, production correctness outside the executed scope, or the absence of untested defects.</div></main></body></html>`;
}

function buildClaims(facts: ExecutionFacts, traceabilityCompleteness: number): EvidenceClaim[] {
  const executed = facts.results.filter(result => result.status !== 'skipped');
  const qualityFailures = facts.results.filter(result => result.qualityStatus === 'FAIL');
  const blockers = facts.results.filter(result => result.ciBlocking);
  const known = facts.results.filter(result => result.outcome === 'KNOWN_DEFECT');
  const healedIds = [...new Set(facts.healing.records.map(record => record.testId).filter((value): value is string => Boolean(value)))];
  const noEvidence = facts.total === 0;
  const decision = noEvidence ? 'INSUFFICIENT EVIDENCE' : facts.qualityGate.status === 'ATTENTION_REQUIRED' ? 'HOLD' : facts.qualityGate.status === 'PASSED_WITH_ACCEPTED_RISK' ? 'PROCEED WITH ACCEPTED RISK' : 'PROCEED';
  const risk = deriveExplainableReleaseRisk(facts);
  const qualityDenominator = facts.outcomes.qualityPassed + facts.qualityFailed;
  return [
    {
      id: 'release-decision', label: 'Release recommendation', value: decision,
      status: noEvidence ? 'INCOMPLETE' : facts.qualityGate.status === 'ATTENTION_REQUIRED' ? 'ATTENTION' : 'SUPPORTED',
      explanation: noEvidence ? 'No reported scenario evidence exists, so TestigentAI refuses to infer a release recommendation.' : 'Rule-based recommendation derived from the deterministic quality gate. AI narration cannot change it.',
      sourceFields: ['qualityGate.status', 'qualityGate.reasons', 'ciBlockingIssues', 'knownDefects'],
      testIds: blockers.map(result => result.testId)
    },
    {
      id: 'release-risk', label: 'Explainable release risk', value: `${risk.level} · ${risk.evidenceConfidence} EVIDENCE`,
      status: risk.level === 'HIGH' ? 'ATTENTION' : risk.level === 'UNKNOWN' || risk.evidenceConfidence === 'PARTIAL' ? 'INCOMPLETE' : 'SUPPORTED',
      explanation: `Score-free risk classification from named signals: ${risk.factors.join('; ')}`,
      sourceFields: ['ciBlockingIssues', 'blockedSkipped', 'knownDefects', 'flakiness.flakyTests', 'healing.rejected', 'healing.unverified', 'executionRate'],
      testIds: unique([...blockers, ...known, ...facts.results.filter(result => result.flaky)].map(result => result.testId))
    },
    {
      id: 'execution-coverage', label: 'Applicable execution coverage', value: facts.executionEligible > 0 ? `${facts.executionRate}%` : 'N/A',
      status: facts.executionEligible === 0 ? 'INCOMPLETE' : facts.executionRate < 100 ? 'ATTENTION' : 'SUPPORTED',
      explanation: facts.executionEligible === 0 ? 'No applicable scenario denominator is available, so execution coverage is not reported as a percentage.' : 'Not-applicable scenarios are excluded from the denominator; blocked applicable scenarios remain visible.',
      formula: facts.executionEligible > 0 ? `${facts.executed} executed / ${facts.executionEligible} applicable × 100 = ${facts.executionRate}%` : 'N/A — zero applicable scenarios',
      sourceFields: ['executed', 'executionEligible', 'notApplicable', 'blockedSkipped'],
      testIds: executed.map(result => result.testId)
    },
    {
      id: 'quality-pass-rate', label: 'Quality pass rate', value: qualityDenominator > 0 ? `${facts.qualityPassRate}%` : 'N/A',
      status: qualityDenominator === 0 ? 'INCOMPLETE' : facts.qualityPassRate >= facts.qualityGate.passThreshold ? 'SUPPORTED' : 'ATTENTION',
      explanation: qualityDenominator === 0 ? 'No quality-executed scenarios are available; TestigentAI does not present an empty denominator as a passing rate.' : 'Known defects remain quality failures even when explicitly accepted as non-blocking debt.',
      formula: qualityDenominator > 0 ? `${facts.outcomes.qualityPassed} quality-passed / ${qualityDenominator} quality-executed × 100 = ${facts.qualityPassRate}%` : 'N/A — zero quality-executed scenarios',
      sourceFields: ['outcomes.qualityPassed', 'outcomes.qualityFailed', 'qualityPassRate'],
      testIds: facts.results.filter(result => result.qualityStatus !== 'NEUTRAL').map(result => result.testId)
    },
    {
      id: 'quality-failures', label: 'Quality failures', value: String(facts.qualityFailed),
      status: facts.qualityFailed ? 'ATTENTION' : 'SUPPORTED',
      explanation: 'Includes accepted known defects and unexpected failed scenarios; the ledger keeps those categories separate.',
      sourceFields: ['qualityFailed', 'knownDefects', 'unexpectedFailed'],
      testIds: qualityFailures.map(result => result.testId)
    },
    {
      id: 'ci-blockers', label: 'CI-blocking issues', value: String(facts.ciBlockingIssues),
      status: facts.ciBlockingIssues ? 'ATTENTION' : 'SUPPORTED',
      explanation: 'Unexpected failures and stale expected-failure markers are blocking. Accepted known defects alone are not.',
      sourceFields: ['ciBlockingIssues', 'unexpectedFailed', 'unexpectedPass'],
      testIds: blockers.map(result => result.testId)
    },
    {
      id: 'known-defects', label: 'Accepted known-defect debt', value: String(facts.knownDefects),
      status: facts.knownDefects ? 'ATTENTION' : 'SUPPORTED',
      explanation: 'Known defects are explicitly registered quality debt; they are never converted into clean passes.',
      sourceFields: ['knownDefects', 'results[].knownDefect', 'results[].outcome'],
      testIds: known.map(result => result.testId)
    },
    {
      id: 'validated-healing', label: 'Semantically validated healing', value: String(facts.healing.count),
      status: (facts.healing.unverified ?? 0) > 0 ? 'INCOMPLETE' : 'SUPPORTED',
      explanation: 'Only semantically validated recoveries count as healed. Rejected, suggested and unverified attempts remain diagnostic evidence only.',
      sourceFields: ['healing.records', 'healing.rejected', 'healing.unverified'],
      testIds: healedIds
    },
    {
      id: 'ai-runtime', label: 'AI runtime calls', value: String(facts.aiUsage?.calls ?? 0),
      status: (facts.aiUsage?.errorCalls ?? 0) > 0 ? 'ATTENTION' : 'SUPPORTED',
      explanation: 'Provider/model/call outcomes are audit facts. AI usage is reported separately from deterministic pass/fail calculations.',
      sourceFields: ['aiUsage.calls', 'aiUsage.providers', 'aiUsage.records'],
      testIds: [...new Set((facts.aiUsage?.records ?? []).map(record => record.testId).filter((value): value is string => Boolean(value)))]
    },
    {
      id: 'traceability', label: 'Scenario traceability completeness', value: facts.results.length ? `${traceabilityCompleteness}%` : 'N/A',
      status: facts.results.length > 0 && traceabilityCompleteness === 100 ? 'SUPPORTED' : 'INCOMPLETE',
      explanation: 'A scenario is traceable when it has an immutable test id, source file and captured execution attempt. This is traceability completeness, not a claim of functional coverage.',
      formula: facts.results.length ? `${facts.results.filter(result => result.testId && result.sourceFile && result.attempts.length > 0).length} traceable / ${facts.results.length} reported × 100 = ${traceabilityCompleteness}%` : 'N/A — zero reported scenarios',
      sourceFields: ['results[].testId', 'results[].sourceFile', 'results[].attempts'],
      testIds: facts.results.map(result => result.testId)
    }
  ];
}

function unique(values: string[]): string[] { return [...new Set(values.filter(Boolean))].sort(); }

function requirementIds(tags: string[]): string[] {
  const values = new Set<string>();
  for (const tag of tags) {
    const match = tag.match(/^@?requirement:(.+)$/i);
    if (match?.[1]) values.add(match[1].trim());
  }
  return [...values].sort();
}

function addNode(nodes: EvidenceNode[], nodeIds: Set<string>, node: EvidenceNode): void {
  if (nodeIds.has(node.id)) return;
  nodeIds.add(node.id);
  nodes.push(node);
}
function scenarioNodeId(testId: string): string { return `scenario:${normalizeId(testId)}`; }
function claimNodeId(id: string): string { return `claim:${normalizeId(id)}`; }
function normalizeId(value: string): string { return value.replace(/[^a-zA-Z0-9._:-]/g, '-').slice(0, 220); }
function legacyOutcome(status: BusinessTestResult['status']): BusinessOutcome { return status === 'passed' ? 'PASSED' : status === 'failed' ? 'FAILED' : 'SKIPPED'; }
function safeEvidenceHref(reportPath?: string): string | undefined {
  if (!reportPath) return undefined;
  const normalized = reportPath.replace(/\\/g, '/');
  if (normalized.startsWith('/') || /^[a-zA-Z]:\//.test(normalized) || normalized.split('/').includes('..')) return undefined;
  return `./${normalized.split('/').map(segment => encodeURIComponent(segment)).join('/')}`;
}
function escapeHtml(value: string): string { return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c); }
function escapeAttr(value: string): string { return escapeHtml(value); }
