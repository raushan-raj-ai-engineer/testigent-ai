import { FAILURE_INTELLIGENCE_CATEGORIES, type FailureClusterIntelligence, type FailureConfidence, type FailureIntelligenceSummary, type FailureSignal } from './failure-intelligence.types.js';
import { classifyFailureDeterministically } from './deterministic-classifier.js';

/** Analyzes failures into evidence-backed classifications and cause-aware incident clusters. */
export function analyzeFailureIntelligence(signals: FailureSignal[]): FailureIntelligenceSummary {
  const classifications = signals.map(classifyFailureDeterministically);
  const categories = Object.fromEntries(FAILURE_INTELLIGENCE_CATEGORIES.map(category => [category, 0])) as FailureIntelligenceSummary['categories'];
  for (const item of classifications) categories[item.category] += 1;
  const clusters = cluster(classifications);
  const modes = new Set(classifications.map(item => item.evidenceMode));
  const evidenceMode = modes.size === 0 ? 'UNVERIFIED' : modes.size === 1 ? [...modes][0]! : 'MIXED';
  const claimEligible = classifications.length > 0 && classifications.every(item => item.claimEligible) && evidenceMode === 'LIVE';
  return { analyzedScenarios: classifications.length, uniqueIncidents: clusters.length, unknownScenarios: categories.UNKNOWN, categories, classifications, clusters, evidenceMode, claimEligible,
    truthBoundary: evidenceMode === 'SHOWCASE' || evidenceMode === 'MIXED' ? 'SHOWCASE/SYNTHETIC evidence is demonstration-only and can never become customer, benchmark, release or market evidence.' : evidenceMode === 'UNVERIFIED' ? 'Caller/model supplied failure evidence is UNVERIFIED and non-claimable until resolved to server-owned execution artifacts.' : 'Classification is deterministic evidence, not proof of ownership. UNKNOWN remains UNKNOWN when evidence is insufficient.' };
}
function cluster(classifications: FailureIntelligenceSummary['classifications']): FailureClusterIntelligence[] {
  const byIncident = new Map<string, FailureClusterIntelligence>();
  for (const item of classifications) {
    const existing = byIncident.get(item.fingerprint);
    if (existing) {
      existing.affectedScenarios += 1; if (!existing.applications.includes(item.application)) existing.applications.push(item.application); if (!existing.scenarioIds.includes(item.scenarioId)) existing.scenarioIds.push(item.scenarioId); if (!existing.titles.includes(item.title)) existing.titles.push(item.title); existing.confidence = lowerConfidence(existing.confidence, item.confidence);
    } else byIncident.set(item.fingerprint, { fingerprint: item.fingerprint, category: item.category, affectedScenarios: 1, applications: [item.application], scenarioIds: [item.scenarioId], titles: [item.title], confidence: item.confidence, recommendation: item.recommendation });
  }
  for (const item of byIncident.values()) { item.applications.sort(); item.scenarioIds.sort(); item.titles.sort(); }
  return [...byIncident.values()].sort((a, b) => b.affectedScenarios - a.affectedScenarios || a.category.localeCompare(b.category) || a.fingerprint.localeCompare(b.fingerprint));
}
function lowerConfidence(left: FailureConfidence, right: FailureConfidence): FailureConfidence { const rank: Record<FailureConfidence, number> = { HIGH: 4, MEDIUM: 3, LOW: 2, INSUFFICIENT_EVIDENCE: 1 }; return rank[left] <= rank[right] ? left : right; }
