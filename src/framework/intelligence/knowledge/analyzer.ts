/** Deterministic-first automation-readiness analysis. Author: Raushan Raj */
import type { AutomationLayer, RequirementAnalysis, RequirementDocument, ReusableCandidate } from '../core/models.js';
import { discoverReusable, semanticTokens } from './framework.discovery.js';
import { resolveApplicationTarget } from './application.resolver.js';
import { matchApplicationKnowledge } from './knowledge.matcher.js';

const NEGATIVE_SCENARIO = /\b(declin(?:e|ed)|fail(?:s|ed|ure)?|invalid|error|unauthori[sz]ed|forbidden|missing|required|duplicate|expired|insufficient|reject(?:ed|s)?|cannot|can't|should not|not allowed)\b/i;

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values.map(v => v.trim()).filter(Boolean)) {
    const key = value.toLowerCase().replace(/\s+/g, ' ');
    if (seen.has(key)) continue;
    seen.add(key); out.push(value);
  }
  return out;
}

function deriveScenarios(requirement: RequirementDocument): string[] {
  const explicit = unique(requirement.scenarioHints ?? []);
  const negatives = requirement.acceptanceCriteria.filter(value => NEGATIVE_SCENARIO.test(value));
  if (explicit.length) return unique([...explicit, ...negatives]);
  // Acceptance criteria are assertions/behavioural rules, not automatically N independent tests.
  // Use one primary business scenario plus clearly distinct negative/error paths.
  return unique([requirement.title, ...negatives]);
}

function classifyCandidateRoles(requirement: RequirementDocument, candidates: ReusableCandidate[]): ReusableCandidate[] {
  const featureTokens = semanticTokens([requirement.feature, requirement.title].filter(Boolean).join(' '));
  return candidates.map(candidate => {
    const matched = new Set(candidate.matchedTerms ?? []);
    const featureMatch = [...featureTokens].some(token => matched.has(token));
    return { ...candidate, role: featureMatch ? 'feature' : 'supporting' } as ReusableCandidate;
  }).filter(candidate => !(['fixture', 'data'] as ReusableCandidate['kind'][]).includes(candidate.kind) || candidate.role === 'feature');
}

export async function analyzeRequirement(root: string, requirement: RequirementDocument): Promise<RequirementAnalysis> {
  const text = [
    requirement.title, requirement.description, ...(requirement.preconditions ?? []), ...(requirement.scenarioHints ?? []),
    ...requirement.acceptanceCriteria, ...requirement.manualTestSteps.map(step => `${step.action} ${step.expectedResult ?? ''}`), ...requirement.expectedResults
  ].filter(Boolean).join(' ').toLowerCase();

  const layers: AutomationLayer[] = [];
  if (/\b(ui|screen|page|button|field|form|browser|click|visible|message|modal|dropdown|login|checkout|cart|select|navigate|open)\b/.test(text) || requirement.manualTestSteps.length) layers.push('UI');
  if (/\b(api|endpoint|http|status code|response|request|post|get|put|patch|delete endpoint|service)\b/.test(text)) layers.push('API');
  if (/\b(database|db|table|record|persist|stored|repository|sql|column|row)\b/.test(text)) layers.push('DATABASE');
  if (!layers.length) layers.push('UI');

  const scenarios = deriveScenarios(requirement);
  const missing: string[] = [];
  if (!requirement.description && !requirement.acceptanceCriteria.length && !requirement.manualTestSteps.length) {
    missing.push('No description, acceptance criteria, or manual test steps were provided.');
  }

  const conflicts: string[] = [];
  const codes = (values: string[]): Set<string> => new Set(values.flatMap(value => value.match(/\b(?:200|201|202|204|400|401|403|404|409|422|500|503)\b/g) ?? []));
  const acCodes = codes(requirement.acceptanceCriteria);
  const erCodes = codes(requirement.expectedResults);
  if (acCodes.size && erCodes.size && ![...acCodes].some(code => erCodes.has(code))) {
    conflicts.push(`Conflicting HTTP expectations detected: acceptance criteria [${[...acCodes].join(', ')}] vs expected results [${[...erCodes].join(', ')}].`);
  }

  const discoveryQuery = [
    requirement.title, requirement.feature, ...(requirement.scenarioHints ?? []), ...requirement.tags,
    ...requirement.manualTestSteps.map(step => step.action), ...requirement.acceptanceCriteria
  ].filter(Boolean).join(' ');
  const discovered = classifyCandidateRoles(requirement, await discoverReusable(root, discoveryQuery));
  const applicationResolution = await resolveApplicationTarget(root, requirement, discovered);
  const candidateApp = (candidate: ReusableCandidate): string | undefined => /(?:^|\/)src\/applications\/([^/]+)\//i.exec(candidate.path.replace(/\\/g, '/'))?.[1];
  const reusable = applicationResolution.app
    ? discovered.filter(candidate => !candidateApp(candidate) || candidateApp(candidate) === applicationResolution.app)
    : discovered;
  const applicationKnowledge = await matchApplicationKnowledge(root, requirement, applicationResolution.app);
  const approvedKnowledge = applicationKnowledge.filter(item => item.status === 'APPROVED');
  const knowledgeGaps: string[] = [];
  if (applicationResolution.app) {
    if (layers.includes('UI') && !approvedKnowledge.some(item => item.kind === 'page' || item.kind === 'journey')) {
      knowledgeGaps.push(`No approved UI/journey knowledge matched application '${applicationResolution.app}'. Generated UI code must remain review-blocked.`);
    }
    if (layers.includes('API') && !approvedKnowledge.some(item => item.kind === 'api')) {
      knowledgeGaps.push(`No approved API observation matched application '${applicationResolution.app}'. Do not invent endpoint details.`);
    }
  }
  const readiness = conflicts.length || missing.length
    ? 'BLOCKED'
    : reusable.some(candidate => candidate.role === 'feature' && candidate.score >= 0.70)
      ? 'HIGH'
      : requirement.manualTestSteps.length && requirement.acceptanceCriteria.length
        ? 'HIGH'
        : approvedKnowledge.length && requirement.acceptanceCriteria.length
          ? 'HIGH'
          : 'MEDIUM';

  return {
    requirement,
    suggestedLayers: layers,
    suggestedScenarios: scenarios,
    missingInformation: unique(missing),
    conflicts,
    readiness,
    reusableCandidates: reusable,
    applicationResolution,
    applicationKnowledge,
    knowledgeGaps
  };
}
