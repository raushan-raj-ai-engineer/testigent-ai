import { createHash } from 'node:crypto';
import type { RequirementAnalysis } from '../../intelligence/core/models.js';
import { buildTestPlan } from '../../intelligence/generation/test-plan.js';
import type { AgentEvidenceReference } from '../contracts/agent.types.js';
import type { AgenticTestLane, PlannedScenario, TestPlanProposal } from '../contracts/plan.types.js';

function laneForLayers(layers: string[]): AgenticTestLane {
  const normalized = new Set(layers.map(value => value.toUpperCase()));
  if (normalized.size > 1) return 'mixed';
  if (normalized.has('API')) return 'api';
  if (normalized.has('DATABASE')) return 'database';
  return 'ui';
}

function confidenceFor(readiness: RequirementAnalysis['readiness']): number {
  if (readiness === 'HIGH') return 0.92;
  if (readiness === 'MEDIUM') return 0.76;
  if (readiness === 'LOW') return 0.55;
  return 0.2;
}

function stablePlanId(analysis: RequirementAnalysis): string {
  const seed = JSON.stringify({
    requirement: analysis.requirement.sourceId,
    app: analysis.applicationResolution?.app,
    layers: analysis.suggestedLayers,
    scenarios: analysis.suggestedScenarios,
    missing: analysis.missingInformation,
    conflicts: analysis.conflicts,
  });
  return `plan-${createHash('sha256').update(seed).digest('hex').slice(0, 16)}`;
}

/** Converts existing deterministic requirement intelligence into an auditable agentic planning proposal. */
export function buildAgenticTestPlan(analysis: RequirementAnalysis): TestPlanProposal {
  const base = buildTestPlan(analysis);
  const requirementEvidence: AgentEvidenceReference = {
    kind: 'requirement',
    ref: analysis.requirement.sourceId,
    description: analysis.requirement.title,
  };
  const reusableEvidence: AgentEvidenceReference[] = analysis.reusableCandidates.slice(0, 8).map(candidate => ({
    kind: 'source',
    ref: candidate.path,
    description: `${candidate.kind} reuse candidate score=${candidate.score}`,
  }));
  const lane = laneForLayers(analysis.suggestedLayers);
  const scenarios: PlannedScenario[] = base.scenarios.map(scenario => ({
    id: scenario.id,
    title: scenario.title,
    lane,
    rationale: scenario.reviewRequired ? 'Scenario was inferred and requires review before generation.' : 'Scenario is supported by explicit requirement evidence.',
    reviewRequired: scenario.reviewRequired,
    evidence: [requirementEvidence],
  }));
  const blocked = analysis.readiness === 'BLOCKED' || analysis.conflicts.length > 0;
  const incomplete = analysis.missingInformation.length > 0 || !analysis.applicationResolution?.app;
  const state = blocked ? 'REVIEW_REQUIRED' : incomplete ? 'INSUFFICIENT_EVIDENCE' : scenarios.some(item => item.reviewRequired) ? 'REVIEW_REQUIRED' : 'ACCEPTED';
  const reasons = [
    `Requirement readiness=${analysis.readiness}.`,
    analysis.applicationResolution?.reason,
    analysis.missingInformation.length ? `Missing information: ${analysis.missingInformation.join('; ')}` : undefined,
    analysis.conflicts.length ? `Conflicts: ${analysis.conflicts.join('; ')}` : undefined,
  ].filter((value): value is string => Boolean(value));
  return {
    version: 1,
    planId: stablePlanId(analysis),
    project: analysis.applicationResolution?.app,
    requirementRef: analysis.requirement.sourceId,
    title: analysis.requirement.title,
    state,
    rationale: reasons.join(' '),
    confidence: confidenceFor(analysis.readiness),
    lanes: [...new Set(analysis.suggestedLayers.map(value => laneForLayers([value])))],
    scenarios,
    missingInformation: [...analysis.missingInformation],
    conflicts: [...analysis.conflicts],
    evidence: [requirementEvidence, ...reusableEvidence],
  };
}
