/** Reviewed functional knowledge store with safe versioning. Author: Raushan Raj */
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { sanitizeKnowledgeValue } from './knowledge.redactor.js';

export type KnowledgeKind = 'page'|'journey'|'api'|'note';
export type KnowledgeStatus = 'REVIEW_REQUIRED'|'APPROVED'|'REJECTED';

export interface KnowledgeRecord {
  id:string;
  kind:KnowledgeKind;
  title:string;
  data:unknown;
  learnedAt:string;
  source:string;
  reviewRequired:boolean;
  status?:KnowledgeStatus;
  application?:string;
  origin?:string;
  fingerprint?:string;
  revision?:number;
  reviewedAt?:string;
  reviewedBy?:string;
  reviewNote?:string;
}

export interface KnowledgeSearchOptions {
  application?:string;
  status?:KnowledgeStatus;
  kinds?:KnowledgeKind[];
  limit?:number;
}

export interface KnowledgeSearchResult extends KnowledgeRecord { score:number; }
export interface KnowledgeBundle { schemaVersion:1; exportedAt:string; application?:string; records:KnowledgeRecord[]; }

function safe(value:string):string {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120)||'knowledge';
}

function fingerprint(record: Pick<KnowledgeRecord,'kind'|'title'|'data'|'source'|'application'|'origin'>): string {
  const stable={kind:record.kind,title:record.title,data:record.data,source:record.source,application:record.application,origin:record.origin};
  return createHash('sha256').update(JSON.stringify(stable)).digest('hex').slice(0,20);
}

function tokens(value:string):Set<string> {
  const ignored=new Set(['the','a','an','and','or','to','of','for','in','on','with','page','api','application','test']);
  return new Set(value.toLowerCase().replace(/[^a-z0-9]+/g,' ').split(/\s+/).filter(token=>token.length>2&&!ignored.has(token)));
}

/**
 * Reusable framework class `ApplicationKnowledgeStore`.
 * Business Use: Centralizes shared TestigentAI behavior so project teams do not duplicate framework logic.
 * Benefit: Keeps behavior consistent, reviewable and reusable across organizations and applications.
 */
export class ApplicationKnowledgeStore {
  readonly root:string;
  constructor(projectRoot:string){ this.root=join(projectRoot,'.application-knowledge'); }

  private pathFor(record:Pick<KnowledgeRecord,'kind'|'id'>):string { return join(this.root,record.kind,`${safe(record.id)}.json`); }

  private async findById(id:string):Promise<{record:KnowledgeRecord;path:string}|undefined> {
    const target=safe(id);
    for(const kind of ['page','journey','api','note'] as const){
      const path=join(this.root,kind,`${target}.json`);
      try { return { record:JSON.parse(await readFile(path,'utf8')) as KnowledgeRecord, path }; } catch { /* continue */ }
    }
    return undefined;
  }

  async save(input:KnowledgeRecord):Promise<string> {
    const sanitized=sanitizeKnowledgeValue(input);
    const path=this.pathFor(sanitized);
    await mkdir(dirname(path),{recursive:true});
    let existing:KnowledgeRecord|undefined;
    try { existing=JSON.parse(await readFile(path,'utf8')) as KnowledgeRecord; } catch { /* first save */ }
    const nextFingerprint=fingerprint(sanitized);
    const unchanged=Boolean(existing?.fingerprint && existing.fingerprint===nextFingerprint);
    const previousStatus=existing?.status ?? (existing?.reviewRequired===false?'APPROVED':'REVIEW_REQUIRED');
    const preserveDecision=unchanged && (previousStatus==='APPROVED'||previousStatus==='REJECTED');
    const status:KnowledgeStatus=preserveDecision?previousStatus:'REVIEW_REQUIRED';
    const record:KnowledgeRecord={
      ...sanitized,
      fingerprint:nextFingerprint,
      revision:existing ? (unchanged?(existing.revision??1):(existing.revision??1)+1) : 1,
      status,
      reviewRequired:status==='REVIEW_REQUIRED',
      reviewedAt:preserveDecision?existing?.reviewedAt:undefined,
      reviewedBy:preserveDecision?existing?.reviewedBy:undefined,
      reviewNote:preserveDecision?existing?.reviewNote:undefined
    };
    await writeFile(path,JSON.stringify(record,null,2));
    return path;
  }

  async list(kind?:KnowledgeKind):Promise<KnowledgeRecord[]> {
    const dirs=kind?[kind]:['page','journey','api','note'] as const;
    const out:KnowledgeRecord[]=[];
    for(const dir of dirs){
      let names:string[]=[]; try{names=await readdir(join(this.root,dir));}catch{/* empty */}
      for(const name of names.filter(value=>value.endsWith('.json')).sort()){
        try{out.push(JSON.parse(await readFile(join(this.root,dir,name),'utf8')) as KnowledgeRecord);}catch{/* ignore malformed */}
      }
    }
    return out;
  }

  async get(id:string):Promise<KnowledgeRecord|undefined>{ return (await this.findById(id))?.record; }

  async review(id:string,status:Exclude<KnowledgeStatus,'REVIEW_REQUIRED'>,reviewer=process.env.USER??'human-reviewer',note?:string):Promise<KnowledgeRecord>{
    const found=await this.findById(id); if(!found)throw new Error(`Knowledge record '${id}' was not found.`);
    const record:KnowledgeRecord={...found.record,status,reviewRequired:false,reviewedAt:new Date().toISOString(),reviewedBy:reviewer,reviewNote:note};
    await writeFile(found.path,JSON.stringify(record,null,2)); return record;
  }

  async search(query:string,options:KnowledgeSearchOptions={}):Promise<KnowledgeSearchResult[]> {
    const queryTokens=tokens(query); if(!queryTokens.size)return [];
    const records=await this.list();
    const results:KnowledgeSearchResult[]=[];
    for(const record of records){
      const status=record.status??(record.reviewRequired===false?'APPROVED':'REVIEW_REQUIRED');
      if(status==='REJECTED')continue;
      if(options.application&&record.application!==options.application)continue;
      if(options.status&&status!==options.status)continue;
      if(options.kinds&&!options.kinds.includes(record.kind))continue;
      const haystack=tokens(`${record.title} ${JSON.stringify(record.data)}`);
      const matched=[...queryTokens].filter(token=>haystack.has(token));
      if(!matched.length)continue;
      const score=Math.min(0.99,Number((0.35+0.65*(matched.length/queryTokens.size)).toFixed(2)));
      results.push({...record,status,score});
    }
    return results.sort((a,b)=>b.score-a.score||a.title.localeCompare(b.title)).slice(0,options.limit??12);
  }

  async summary(application?:string):Promise<Record<string,unknown>> {
    const records=(await this.list()).filter(record=>!application||record.application===application);
    const status=(record:KnowledgeRecord):KnowledgeStatus=>record.status??(record.reviewRequired===false?'APPROVED':'REVIEW_REQUIRED');
    return {
      application:application??'ALL', total:records.length,
      approved:records.filter(record=>status(record)==='APPROVED').length,
      reviewRequired:records.filter(record=>status(record)==='REVIEW_REQUIRED').length,
      rejected:records.filter(record=>status(record)==='REJECTED').length,
      pages:records.filter(record=>record.kind==='page').length,
      journeys:records.filter(record=>record.kind==='journey').length,
      apis:records.filter(record=>record.kind==='api').length
    };
  }

  async exportApproved(application:string|undefined,path:string):Promise<string>{
    const records=(await this.list()).filter(record=>(!application||record.application===application)&&(record.status??(record.reviewRequired===false?'APPROVED':'REVIEW_REQUIRED'))==='APPROVED');
    const bundle:KnowledgeBundle={schemaVersion:1,exportedAt:new Date().toISOString(),application,records:sanitizeKnowledgeValue(records)};
    await mkdir(dirname(path),{recursive:true}); await writeFile(path,JSON.stringify(bundle,null,2)); return path;
  }

  async importApproved(path:string):Promise<number>{
    const bundle=JSON.parse(await readFile(path,'utf8')) as KnowledgeBundle;
    if(bundle.schemaVersion!==1||!Array.isArray(bundle.records))throw new Error('Unsupported application knowledge bundle.');
    let count=0;
    for(const imported of bundle.records){
      const status=imported.status??(imported.reviewRequired===false?'APPROVED':'REVIEW_REQUIRED');
      if(status!=='APPROVED')continue;
      const record:KnowledgeRecord={...sanitizeKnowledgeValue(imported),source:`approved-import:${imported.source}`,status:'APPROVED',reviewRequired:false,reviewedAt:imported.reviewedAt??bundle.exportedAt,reviewedBy:imported.reviewedBy??'approved-bundle'};
      const target=this.pathFor(record); await mkdir(dirname(target),{recursive:true}); await writeFile(target,JSON.stringify({...record,fingerprint:fingerprint(record),revision:record.revision??1},null,2)); count++;
    }
    return count;
  }
}
