/** Local requirement/manual-test adapters for MD/JSON/CSV/XLSX. Author: Raushan Raj */
import { readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import type { ManualTestStep, RequirementDocument } from '../core/models.js';

const bullets=(xs:string[]=[])=>xs.map(x=>x.replace(/^[-*]\s*/,'').replace(/^\d+[.)]\s*/,'').trim()).filter(Boolean);
function mdSections(text:string){const m=new Map<string,string[]>();let k='description';m.set(k,[]);for(const raw of text.split(/\r?\n/)){const line=raw.trim();const h=/^#{1,6}\s+(.+)$/.exec(line);if(h){k=h[1].trim().toLowerCase();m.set(k,m.get(k)??[]);}else if(line)m.get(k)?.push(line);}return m;}
function mdSteps(xs:string[]=[]):ManualTestStep[]{return bullets(xs).map((s,i)=>{const [action,expected]=s.split(/\s*(?:=>|->|\|)\s*/,2);return {order:i+1,action,...(expected?{expectedResult:expected}: {})};});}
function arr(v:unknown):string[]{return Array.isArray(v)?v.map(String):v==null?[]:[String(v)];}
function lowerRecord(record:Record<string,unknown>):Record<string,unknown>{return Object.fromEntries(Object.entries(record).map(([k,v])=>[k.trim().toLowerCase(),v]));}
function field(o:Record<string,unknown>,...names:string[]):string{for(const name of names){const value=o[name.toLowerCase()];if(value!=null&&String(value).trim())return String(value).trim();}return '';}

/**
 * Reusable framework function `readMarkdownRequirement`.
 * Business Use: Centralizes shared TestigentAI behavior so project teams do not duplicate framework logic.
 * Benefit: Keeps behavior consistent, reviewable and reusable across organizations and applications.
 */
export async function readMarkdownRequirement(filePath:string):Promise<RequirementDocument>{
  const text=await readFile(filePath,'utf8');const s=mdSections(text);const get=(...n:string[])=>n.flatMap(x=>s.get(x)??[]);
  const title=text.split(/\r?\n/).find(x=>/^#\s+/.test(x))?.replace(/^#\s+/,'').trim()||basename(filePath,extname(filePath));
  return {
    sourceType:'markdown',sourceId:basename(filePath,extname(filePath)),title,
    description:get('description','summary').join(' ')||undefined,
    preconditions:bullets(get('preconditions','precondition','given')),
    scenarioHints:bullets(get('scenarios','scenario','test scenarios','test scenario')),
    acceptanceCriteria:bullets(get('acceptance criteria','criteria','acceptance criterion')),
    manualTestSteps:mdSteps(get('test steps','manual test steps','steps')),
    expectedResults:bullets(get('expected results','expected result')),
    tags:bullets(get('tags')).flatMap(x=>x.split(/[ ,]+/)).filter(Boolean),
    priority:get('priority')[0]?.replace(/^[-*]\s*/,''),feature:get('feature')[0]?.replace(/^[-*]\s*/,''),links:bullets(get('links')),raw:text
  };
}

/**
 * Reusable framework function `readJsonRequirement`.
 * Business Use: Centralizes shared TestigentAI behavior so project teams do not duplicate framework logic.
 * Benefit: Keeps behavior consistent, reviewable and reusable across organizations and applications.
 */
export async function readJsonRequirement(filePath:string):Promise<RequirementDocument>{
  const raw=JSON.parse(await readFile(filePath,'utf8')) as Record<string,any>;
  const steps=(Array.isArray(raw.manualTestSteps??raw.steps)?(raw.manualTestSteps??raw.steps):[])
    .map((v:any,i:number)=>typeof v==='string'?{order:i+1,action:v}:{order:Number(v.order??i+1),action:String(v.action??''),expectedResult:v.expectedResult?String(v.expectedResult):undefined})
    .filter((x:ManualTestStep)=>x.action);
  return {
    sourceType:'json',sourceId:String(raw.sourceId??raw.id??basename(filePath,extname(filePath))),title:String(raw.title??raw.summary??basename(filePath,extname(filePath))),
    description:raw.description?String(raw.description):undefined,preconditions:arr(raw.preconditions),scenarioHints:arr(raw.scenarios??raw.scenarioHints),
    acceptanceCriteria:arr(raw.acceptanceCriteria),manualTestSteps:steps,expectedResults:arr(raw.expectedResults),tags:arr(raw.tags),
    priority:raw.priority?String(raw.priority):undefined,feature:raw.feature?String(raw.feature):undefined,links:arr(raw.links),raw
  };
}

function parseCsv(t:string){const rows:string[][]=[];let row:string[]=[],cell='',q=false;for(let i=0;i<t.length;i++){const c=t[i];if(c==='"'){if(q&&t[i+1]==='"'){cell+='"';i++;}else q=!q;}else if(c===','&&!q){row.push(cell.trim());cell='';}else if((c==='\n'||c==='\r')&&!q){if(c==='\r'&&t[i+1]==='\n')i++;row.push(cell.trim());cell='';if(row.some(Boolean))rows.push(row);row=[];}else cell+=c;}if(cell||row.length){row.push(cell.trim());if(row.some(Boolean))rows.push(row);}return rows;}

/**
 * Reusable framework function `readCsvRequirement`.
 * Business Use: Centralizes shared TestigentAI behavior so project teams do not duplicate framework logic.
 * Benefit: Keeps behavior consistent, reviewable and reusable across organizations and applications.
 */
export async function readCsvRequirement(filePath:string):Promise<RequirementDocument>{
  const rows=parseCsv(await readFile(filePath,'utf8'));if(!rows.length)throw new Error(`Empty CSV: ${filePath}`);
  const h=rows[0].map(x=>x.trim().toLowerCase());const objs=rows.slice(1).map(r=>Object.fromEntries(h.map((k,i)=>[k,r[i]??''])));const f=lowerRecord((objs[0]??{}) as Record<string,unknown>);
  const normalized=objs.map(o=>lowerRecord(o as Record<string,unknown>));
  const steps=normalized.map((o,i)=>({order:Number(field(o,'step','step no','step number')||i+1),action:field(o,'action','steps','test step'),expectedResult:field(o,'expected','expected result')||undefined})).filter(x=>x.action);
  return {
    sourceType:'csv',sourceId:field(f,'id','test case id')||basename(filePath,extname(filePath)),title:field(f,'title','test case','summary')||basename(filePath,extname(filePath)),
    description:field(f,'description')||undefined,preconditions:normalized.map(o=>field(o,'precondition','preconditions')).filter(Boolean),scenarioHints:normalized.map(o=>field(o,'scenario','test scenario')).filter(Boolean),
    acceptanceCriteria:normalized.map(o=>field(o,'acceptance criteria','criteria')).filter(Boolean),manualTestSteps:steps,
    expectedResults:steps.map(x=>x.expectedResult).filter((x):x is string=>Boolean(x)),tags:field(f,'tags').split(/[ ,;]+/).filter(Boolean),
    priority:field(f,'priority')||undefined,feature:field(f,'feature','component')||undefined,links:[],raw:objs
  };
}

/**
 * Reusable framework function `readExcelRequirement`.
 * Business Use: Centralizes shared TestigentAI behavior so project teams do not duplicate framework logic.
 * Benefit: Keeps behavior consistent, reviewable and reusable across organizations and applications.
 */
export async function readExcelRequirement(filePath:string):Promise<RequirementDocument>{
  const XLSX=await import('xlsx');const wb=XLSX.readFile(filePath);const sheet=wb.Sheets[wb.SheetNames[0]];const rows=XLSX.utils.sheet_to_json<Record<string,unknown>>(sheet,{defval:''});if(!rows.length)throw new Error(`Empty Excel file: ${filePath}`);
  const normalized=rows.map(lowerRecord);const f=normalized[0];
  const steps=normalized.map((o,i)=>({order:Number(field(o,'step','step no','step number')||i+1),action:field(o,'action','steps','test step'),expectedResult:field(o,'expected','expected result')||undefined})).filter(x=>x.action);
  return {
    sourceType:'excel',sourceId:field(f,'id','test case id')||basename(filePath,extname(filePath)),title:field(f,'title','test case','summary')||basename(filePath,extname(filePath)),
    description:field(f,'description')||undefined,preconditions:normalized.map(o=>field(o,'precondition','preconditions')).filter(Boolean),scenarioHints:normalized.map(o=>field(o,'scenario','test scenario')).filter(Boolean),
    acceptanceCriteria:normalized.map(o=>field(o,'acceptance criteria','criteria')).filter(Boolean),manualTestSteps:steps,
    expectedResults:steps.map(x=>x.expectedResult).filter((x):x is string=>Boolean(x)),tags:field(f,'tags').split(/[ ,;]+/).filter(Boolean),
    priority:field(f,'priority')||undefined,feature:field(f,'feature','component')||undefined,links:[],raw:rows
  };
}

/**
 * Reusable framework function `readLocalRequirement`.
 * Business Use: Centralizes shared TestigentAI behavior so project teams do not duplicate framework logic.
 * Benefit: Keeps behavior consistent, reviewable and reusable across organizations and applications.
 */
export async function readLocalRequirement(filePath:string){const e=extname(filePath).toLowerCase();if(['.md','.markdown'].includes(e))return readMarkdownRequirement(filePath);if(e==='.json')return readJsonRequirement(filePath);if(e==='.csv')return readCsvRequirement(filePath);if(['.xlsx','.xls'].includes(e))return readExcelRequirement(filePath);throw new Error(`Unsupported requirement file type: ${e}`);}
