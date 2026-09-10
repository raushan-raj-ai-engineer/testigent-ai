/** Matches reviewed application knowledge to requirements. Author: Raushan Raj */
import type { ApplicationKnowledgeMatch, RequirementDocument } from '../core/models.js';
import { ApplicationKnowledgeStore } from './store.js';

export async function matchApplicationKnowledge(root:string,requirement:RequirementDocument,application?:string):Promise<ApplicationKnowledgeMatch[]>{
  if(!application)return[];
  const query=[requirement.feature,requirement.title,requirement.description,...(requirement.scenarioHints??[]),...requirement.acceptanceCriteria,...requirement.manualTestSteps.map(step=>step.action)].filter(Boolean).join(' ');
  const store=new ApplicationKnowledgeStore(root);
  const matches=await store.search(query,{application,limit:12});
  return matches.map(match=>({id:match.id,kind:match.kind,title:match.title,application:match.application,source:match.source,status:match.status??(match.reviewRequired===false?'APPROVED':'REVIEW_REQUIRED'),score:match.score}));
}
