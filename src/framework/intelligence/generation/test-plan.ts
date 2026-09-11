/** Normalized test-plan builder. Author: Raushan Raj */
import type { RequirementAnalysis } from '../core/models.js';

const NEGATIVE_SCENARIO = /\b(declin(?:e|ed)|fail(?:s|ed|ure)?|invalid|error|unauthori[sz]ed|forbidden|missing|required|duplicate|expired|insufficient|reject(?:ed|s)?|cannot|can't|should not|not allowed)\b/i;
const OMIT = new Set(['the','a','an','is','are','be','becomes','become','should','must','successful','successfully','in','to','of','for','with']);
const SYNONYM: Record<string,string> = {
  returns:'response', return:'response', returned:'response', responds:'response', response:'response',
  stored:'persist', stores:'persist', store:'persist', persisted:'persist', persists:'persist', persist:'persist', exists:'persist', exist:'persist',
  database:'database', db:'database'
};

function assertionKey(value: string): string {
  const tokens = value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(/\s+/).filter(Boolean)
    .map(token => SYNONYM[token] ?? token).filter(token => !OMIT.has(token));
  return [...new Set(tokens)].sort().join(' ');
}

function semanticUnique(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values.map(item => item.trim()).filter(Boolean)) {
    const key = assertionKey(value);
    if (seen.has(key)) continue;
    seen.add(key); out.push(value);
  }
  return out;
}

/**
 * Reusable framework function `buildTestPlan`.
 * Business Use: Centralizes shared TestigentAI behavior so project teams do not duplicate framework logic.
 * Benefit: Keeps behavior consistent, reviewable and reusable across organizations and applications.
 */
export function buildTestPlan(analysis: RequirementAnalysis) {
  const requirement = analysis.requirement;
  const hasManualJourney = requirement.manualTestSteps.length > 0;
  const positiveCriteria = requirement.acceptanceCriteria.filter(value => !NEGATIVE_SCENARIO.test(value));

  const scenarios = analysis.suggestedScenarios.map((title, index) => {
    const isPrimaryManualJourney = hasManualJourney && index === 0;
    const explicitScenario = (requirement.scenarioHints ?? []).some(value => value.toLowerCase() === title.toLowerCase());
    const manualSteps = isPrimaryManualJourney ? requirement.manualTestSteps : [];
    const assertions = isPrimaryManualJourney
      ? semanticUnique([...positiveCriteria, ...requirement.expectedResults, ...requirement.manualTestSteps.map(step => step.expectedResult ?? '').filter(Boolean)])
      : semanticUnique([title]);
    return {
      id: `S${index + 1}`,
      title,
      preconditions: requirement.preconditions ?? [],
      manualSteps,
      assertions,
      reviewRequired: manualSteps.length === 0 && !explicitScenario
    };
  });

  return {
    requirementId: requirement.sourceId,
    title: requirement.title,
    source: requirement.sourceType,
    feature: requirement.feature,
    priority: requirement.priority,
    targetApplication: analysis.applicationResolution?.app,
    applicationResolution: analysis.applicationResolution,
    readiness: analysis.readiness,
    layers: analysis.suggestedLayers,
    tags: [...new Set([...requirement.tags, `@requirement:${requirement.sourceId}`, ...(analysis.applicationResolution?.app ? [`@app:${analysis.applicationResolution.app}`] : [])])],
    scenarios,
    missingInformation: analysis.missingInformation,
    conflicts: analysis.conflicts,
    reusableCandidates: analysis.reusableCandidates,
    applicationKnowledge: analysis.applicationKnowledge ?? [],
    knowledgeGaps: analysis.knowledgeGaps ?? [],
    reviewRequired: true
  };
}
