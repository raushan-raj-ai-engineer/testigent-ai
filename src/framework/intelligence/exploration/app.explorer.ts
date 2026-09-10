/** Safe automated explorer + human-guided functional learner. Author: Raushan Raj */
import { chromium, type BrowserContext, type Frame, type Page, type Response } from '@playwright/test';
import { ApplicationKnowledgeStore, type KnowledgeRecord } from '../knowledge/store.js';
import { normalizeRoutePath, redactKnowledgeText, safeVisibleText, sanitizeKnowledgeValue } from '../knowledge/knowledge.redactor.js';
import { resolveApplicationForUrl } from '../knowledge/application.resolver.js';
import { contextOptionsWithAuth } from './auth.state.js';

const DESTRUCTIVE=/\b(delete|remove|refund|cancel(?:\s+order)?|terminate|deactivate|purchase|pay(?:\s+now)?|place\s+order|submit|confirm(?:\s+payment)?|logout|sign\s*out|close\s+account|disable)\b/i;
const API_TYPES=new Set(['xhr','fetch']);

interface SafeLink { href:string;text:string;aria:string; }
interface GuidedEvent { type:'click'|'change'|'submit'|'navigation'; at:string; urlPattern:string; tag?:string; role?:string; name?:string; inputType?:string; }
interface NetworkFact { method:string;path:string;status:number;contentType:string;resourceType:string;count:number; }

function allowedEnvironment():void{
  const env=(process.env.ENV??process.env.TEST_ENV??'qa').toLowerCase();
  const allowed=(process.env.EXPLORATION_ALLOWED_ENVIRONMENTS??'dev,qa,test,staging').split(',').map((value:string)=>value.trim().toLowerCase()).filter(Boolean);
  if(!allowed.includes(env))throw new Error(`Exploration blocked for '${env}'. Allowed: ${allowed.join(', ')}`);
}

function parsedBase(base:string):URL{
  let url:URL; try{url=new URL(base);}catch{throw new Error(`APP_BASE_URL must be a valid absolute URL. Received: '${base}'.`);}
  if(!['http:','https:'].includes(url.protocol))throw new Error(`APP_BASE_URL must use http/https. Received protocol '${url.protocol}'.`);
  url.hash=''; return url;
}

function allowedOrigins(base:URL):Set<string>{
  const origins=new Set([base.origin]);
  for(const raw of (process.env.EXPLORATION_ALLOWED_ORIGINS??'').split(',').map((value:string)=>value.trim()).filter(Boolean)){
    try{origins.add(new URL(raw).origin);}catch{throw new Error(`Invalid EXPLORATION_ALLOWED_ORIGINS entry: '${raw}'.`);}
  }
  return origins;
}

function canonical(url:URL):string{const copy=new URL(url);copy.hash='';copy.search='';copy.pathname=copy.pathname.replace(/\/{2,}/g,'/');return copy.toString();}
function knowledgeId(app:string,url:URL):string{const route=normalizeRoutePath(url.pathname)==='/'?'home':normalizeRoutePath(url.pathname);return `${app}-${url.host}-${route}`;}
function boundedNumber(name:string,fallback:number,min:number,max:number):number{const raw=Number(process.env[name]??fallback);return Number.isFinite(raw)?Math.max(min,Math.min(max,Math.floor(raw))):fallback;}
function maxPages():number{return boundedNumber('EXPLORATION_MAX_PAGES',20,1,100);}
function maxDepth():number{return boundedNumber('EXPLORATION_MAX_DEPTH',4,0,12);}
function timeoutMs():number{return boundedNumber('EXPLORATION_NAVIGATION_TIMEOUT_MS',15000,1000,60000);}
function captureText():boolean{return !['0','false','no','off'].includes((process.env.EXPLORATION_CAPTURE_VISIBLE_TEXT??'true').toLowerCase());}

function networkFact(response:Response,baseOrigins:Set<string>):NetworkFact|undefined{
  try{
    const request=response.request(); const resourceType=request.resourceType(); if(!API_TYPES.has(resourceType))return undefined;
    const url=new URL(response.url()); if(!baseOrigins.has(url.origin))return undefined;
    return {method:request.method(),path:normalizeRoutePath(url.pathname),status:response.status(),contentType:response.headers()['content-type']??'',resourceType,count:1};
  }catch{return undefined;}
}

async function observePage(page:Page,store:ApplicationKnowledgeStore,source:string,app:string,baseOrigins:Set<string>):Promise<string>{
  const current=parsedBase(page.url()); if(!baseOrigins.has(current.origin))throw new Error(`Exploration redirected outside allowed origins: '${current.origin}'.`);
  const title=redactKnowledgeText(await page.title().catch(()=>''));
  const headings=captureText()?safeVisibleText(await page.getByRole('heading').allTextContents().catch(()=>[])):[];
  const buttons=captureText()?safeVisibleText(await page.getByRole('button').allTextContents().catch(()=>[])):[];
  const fields=await page.locator('input,textarea,select').evaluateAll((elements:Element[])=>elements.slice(0,80).map(element=>({
    tag:element.tagName.toLowerCase(),name:element.getAttribute('name')??'',type:element.getAttribute('type')??'',placeholder:element.getAttribute('placeholder')??'',ariaLabel:element.getAttribute('aria-label')??'',required:element.hasAttribute('required')
  }))).catch(()=>[] as Array<Record<string,unknown>>);
  const links=await page.locator('a[href]').evaluateAll((elements:Element[])=>elements.slice(0,120).map(element=>({text:(element.textContent??'').trim(),aria:element.getAttribute('aria-label')??'',href:(element as HTMLAnchorElement).href}))).catch(()=>[] as SafeLink[]);
  const safeLinks=(links as SafeLink[]).flatMap((link:SafeLink)=>{try{const url=new URL(link.href);if(!baseOrigins.has(url.origin))return[];return[{name:redactKnowledgeText(link.aria||link.text).slice(0,160),path:normalizeRoutePath(url.pathname),destructive:DESTRUCTIVE.test(`${link.text} ${link.aria} ${url.pathname}`)}];}catch{return[];}});
  const route=normalizeRoutePath(current.pathname);
  const record:KnowledgeRecord={id:knowledgeId(app,current),kind:'page',title:title||headings[0]||route,data:{application:app,origin:current.origin,urlPattern:`${current.origin}${route}`,route,title,headings,buttons,fields:sanitizeKnowledgeValue(fields),links:safeLinks},learnedAt:new Date().toISOString(),source,reviewRequired:true,application:app,origin:current.origin};
  return store.save(record);
}

function attachNetwork(context:BrowserContext,baseOrigins:Set<string>,facts:Map<string,NetworkFact>):void{
  context.on('response',(response:Response)=>{const fact=networkFact(response,baseOrigins);if(!fact)return;const key=`${fact.method}|${fact.path}|${fact.status}`;const previous=facts.get(key);facts.set(key,{...fact,count:(previous?.count??0)+1});});
}

async function installGuidedActionCapture(context:BrowserContext,events:GuidedEvent[],baseOrigins:Set<string>):Promise<void>{
  await context.exposeBinding('__knowledgeEvent',(_source:unknown,payload:unknown)=>{
    const event=sanitizeKnowledgeValue(payload) as Partial<GuidedEvent>;
    if(!event.type||!event.at||!event.urlPattern)return;
    try{const url=new URL(event.urlPattern);if(!baseOrigins.has(url.origin))return;event.urlPattern=`${url.origin}${normalizeRoutePath(url.pathname)}`;}catch{return;}
    events.push(event as GuidedEvent);
  });
  await context.addInitScript(()=>{
    type Emitter=(payload:Record<string,string>)=>Promise<void>;
    const w=window as typeof window & {__knowledgeEvent?:Emitter};
    const describe=(target:EventTarget|null):Record<string,string>=>{
      const element=target instanceof Element?target:undefined; if(!element)return{};
      const label=element.getAttribute('aria-label')||element.getAttribute('title')||element.textContent?.trim().slice(0,140)||element.getAttribute('name')||'';
      return {tag:element.tagName.toLowerCase(),role:element.getAttribute('role')||'',name:label,inputType:element.getAttribute('type')||''};
    };
    const emit=(type:string,target:EventTarget|null):void=>{void w.__knowledgeEvent?.({type,at:new Date().toISOString(),urlPattern:location.origin+location.pathname,...describe(target)});};
    document.addEventListener('click',event=>emit('click',event.target),true);
    document.addEventListener('change',event=>emit('change',event.target),true);
    document.addEventListener('submit',event=>emit('submit',event.target),true);
  });
}

export async function safeExplore(root:string,base=process.env.APP_BASE_URL??''){
  allowedEnvironment(); if(!base)throw new Error('APP_BASE_URL is required.'); const baseUrl=parsedBase(base); const resolution=await resolveApplicationForUrl(root,baseUrl.toString());
  if(!resolution.app)throw new Error(resolution.reason); const app=resolution.app, origins=allowedOrigins(baseUrl), store=new ApplicationKnowledgeStore(root);
  const browser=await chromium.launch({headless:true}); const context=await browser.newContext(await contextOptionsWithAuth(root,app)); const page=await context.newPage();
  const network=new Map<string,NetworkFact>(); attachNetwork(context,origins,network);
  const seen=new Set<string>(),queued=new Set<string>(),queue:Array<{url:string;depth:number}>=[{url:canonical(baseUrl),depth:0}],edges:Array<{from:string;to:string}>=[]; queued.add(canonical(baseUrl));
  try{
    while(queue.length&&seen.size<maxPages()){
      const item=queue.shift()!; if(seen.has(item.url))continue; seen.add(item.url);
      await page.goto(item.url,{waitUntil:'domcontentloaded',timeout:timeoutMs()}); await page.waitForLoadState('networkidle',{timeout:Math.min(timeoutMs(),3000)}).catch(()=>undefined);
      const current=parsedBase(page.url()); if(!origins.has(current.origin))throw new Error(`Exploration redirected outside allowed origins to '${current.origin}'.`);
      await observePage(page,store,'safe-explorer',app,origins);
      if(item.depth>=maxDepth())continue;
      const links=await page.locator('a[href]').evaluateAll((elements:Element[])=>elements.slice(0,160).map(element=>({href:(element as HTMLAnchorElement).href,text:(element.textContent??'').trim(),aria:element.getAttribute('aria-label')??''}))).catch(()=>[] as SafeLink[]);
      for(const link of links){try{const nextUrl=new URL(link.href);const label=`${link.text} ${link.aria} ${nextUrl.pathname}`;if(!origins.has(nextUrl.origin)||DESTRUCTIVE.test(label))continue;const next=canonical(nextUrl);edges.push({from:normalizeRoutePath(current.pathname),to:normalizeRoutePath(nextUrl.pathname)});if(!seen.has(next)&&!queued.has(next)){queue.push({url:next,depth:item.depth+1});queued.add(next);}}catch{/* ignore invalid href */}}
    }
    await store.save({id:`${app}-${baseUrl.host}-network`,kind:'api',title:`Observed API traffic (${app})`,data:{application:app,origins:[...origins],requests:[...network.values()]},learnedAt:new Date().toISOString(),source:'safe-explorer',reviewRequired:true,application:app,origin:baseUrl.origin});
    await store.save({id:`${app}-${baseUrl.host}-navigation-map`,kind:'journey',title:`Safe navigation map (${app})`,data:{application:app,entry:`${baseUrl.origin}${normalizeRoutePath(baseUrl.pathname)}`,edges:[...new Map(edges.map(edge=>[`${edge.from}|${edge.to}`,edge])).values()]},learnedAt:new Date().toISOString(),source:'safe-explorer',reviewRequired:true,application:app,origin:baseUrl.origin});
    return {application:app,pages:seen.size,origin:baseUrl.origin,networkFacts:network.size,knowledgeSummary:await store.summary(app)};
  }finally{await browser.close();}
}

export async function guidedLearn(root:string,base=process.env.APP_BASE_URL??'',journeyName=process.env.EXPLORATION_JOURNEY_NAME??'Guided business journey'){
  allowedEnvironment(); if(!base)throw new Error('APP_BASE_URL is required.'); if(!process.stdin.isTTY)throw new Error('app:learn requires an interactive terminal.');
  const baseUrl=parsedBase(base),resolution=await resolveApplicationForUrl(root,baseUrl.toString()); if(!resolution.app)throw new Error(resolution.reason); const app=resolution.app,origins=allowedOrigins(baseUrl),store=new ApplicationKnowledgeStore(root);
  const browser=await chromium.launch({headless:false}); const context=await browser.newContext(await contextOptionsWithAuth(root,app)); const network=new Map<string,NetworkFact>(),events:GuidedEvent[]=[]; attachNetwork(context,origins,network); await installGuidedActionCapture(context,events,origins);
  const observedPages=new Set<Page>();
  const attachPage=(page:Page):void=>{
    if(observedPages.has(page))return; observedPages.add(page);
    page.on('framenavigated',(frame:Frame)=>{if(frame!==page.mainFrame())return;try{const url=new URL(page.url());if(!origins.has(url.origin))return;events.push({type:'navigation',at:new Date().toISOString(),urlPattern:`${url.origin}${normalizeRoutePath(url.pathname)}`});void observePage(page,store,'guided-learn',app,origins);}catch{/* ignore */}});
  };
  context.on('page',attachPage); const page=await context.newPage(); attachPage(page);
  try{
    await page.goto(baseUrl.toString(),{waitUntil:'domcontentloaded',timeout:timeoutMs()}); await observePage(page,store,'guided-learn',app,origins);
    const {createInterface}=await import('node:readline/promises'); const rl=createInterface({input:process.stdin,output:process.stdout});
    try{await rl.question(`Guided learning for '${app}'. Perform '${journeyName}' in the browser, then press ENTER here to save the journey.\n`);}finally{rl.close();}
    for(const openPage of context.pages()){try{const url=new URL(openPage.url());if(origins.has(url.origin))await observePage(openPage,store,'guided-learn',app,origins);}catch{/* ignore */}}
    await store.save({id:`${app}-${baseUrl.host}-journey-${journeyName}`,kind:'journey',title:journeyName,data:{application:app,entry:`${baseUrl.origin}${normalizeRoutePath(baseUrl.pathname)}`,events,network:[...network.values()]},learnedAt:new Date().toISOString(),source:'guided-learn',reviewRequired:true,application:app,origin:baseUrl.origin});
    await store.save({id:`${app}-${baseUrl.host}-guided-network`,kind:'api',title:`Guided journey API traffic (${app})`,data:{application:app,requests:[...network.values()]},learnedAt:new Date().toISOString(),source:'guided-learn',reviewRequired:true,application:app,origin:baseUrl.origin});
    return {application:app,journey:journeyName,events:events.length,networkFacts:network.size,knowledgeSummary:await store.summary(app)};
  }finally{await browser.close();}
}
