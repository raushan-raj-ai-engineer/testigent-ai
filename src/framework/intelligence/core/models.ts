/** Requirement intelligence domain models. Author: Raushan Raj */
export type RequirementSourceType = 'markdown'|'json'|'csv'|'excel'|'jira'|'azure-boards'|'github-issues'|'unknown';
export type AutomationLayer = 'UI'|'API'|'DATABASE';
export type AutomationReadiness = 'HIGH'|'MEDIUM'|'LOW'|'BLOCKED';
export type ApplicationResolutionSource = 'tag'|'environment'|'url-config'|'feature-reuse'|'single-app'|'explicit-new-app'|'unresolved'|'conflict';
export type ApplicationKnowledgeStatus = 'REVIEW_REQUIRED'|'APPROVED'|'REJECTED';
export interface SourceReference { type: RequirementSourceType; id: string; uri?: string; }
export interface ManualTestStep { order:number; action:string; expectedResult?:string; }
export interface RequirementDocument {
  sourceType:RequirementSourceType;
  sourceId:string;
  title:string;
  description?:string;
  preconditions?:string[];
  scenarioHints?:string[];
  acceptanceCriteria:string[];
  manualTestSteps:ManualTestStep[];
  expectedResults:string[];
  tags:string[];
  priority?:string;
  feature?:string;
  links:string[];
  raw?:unknown;
}
export interface ReusableCandidate {
  kind:'page'|'component'|'workflow'|'api-service'|'db-repository'|'fixture'|'data'|'test';
  name:string;
  path:string;
  score:number;
  matchedTerms?:string[];
  role?:'feature'|'supporting';
}
export interface ApplicationResolution {
  app?:string;
  source:ApplicationResolutionSource;
  reason:string;
  baseUrl?:string;
  candidates:string[];
}
export interface ApplicationKnowledgeMatch {
  id:string;
  kind:'page'|'journey'|'api'|'note';
  title:string;
  application?:string;
  source:string;
  status:ApplicationKnowledgeStatus;
  score:number;
}
export interface RequirementAnalysis {
  requirement:RequirementDocument;
  suggestedLayers:AutomationLayer[];
  suggestedScenarios:string[];
  missingInformation:string[];
  conflicts:string[];
  readiness:AutomationReadiness;
  reusableCandidates:ReusableCandidate[];
  applicationResolution?:ApplicationResolution;
  applicationKnowledge?:ApplicationKnowledgeMatch[];
  knowledgeGaps?:string[];
}
export interface GenerationManifest {
  requirementId:string;
  createdAt:string;
  reviewRequired:true;
  targetApplication?:string;
  reused:ReusableCandidate[];
  knowledgeEvidence?:ApplicationKnowledgeMatch[];
  created:Array<{kind:string;path:string;reason:string}>;
  warnings:string[];
}
export type ExecutionStatus='PASSED'|'FAILED'|'SKIPPED'|'FLAKY'|'BLOCKED';
export interface ExecutionPublishRequest { runId:string; requirementId:string; status:ExecutionStatus; environment?:string; dashboardUrl?:string; total:number; passed:number; failed:number; skipped:number; flaky?:number; selfHealed?:number; aiHealing?:number; failedScenarios?:string[]; }
export interface PublishResult { target:string; requirementId:string; action:string; success:boolean; message?:string; }
