/** Application knowledge + exploration regression coverage. Author: Raushan Raj */
import { test, expect } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ApplicationKnowledgeStore } from '../../src/framework/intelligence/knowledge/store.js';
import { redactKnowledgeText, normalizeRoutePath } from '../../src/framework/intelligence/knowledge/knowledge.redactor.js';
import { safeExplore } from '../../src/framework/intelligence/exploration/app.explorer.js';
import { analyzeRequirement } from '../../src/framework/intelligence/knowledge/analyzer.js';
import type { RequirementDocument } from '../../src/framework/intelligence/core/models.js';

function saveEnv(names:string[]):()=>void{const previous=new Map(names.map(name=>[name,process.env[name]]));return()=>{for(const[name,value]of previous)value===undefined?delete process.env[name]:process.env[name]=value;};}
function requirement():RequirementDocument{return{sourceType:'markdown',sourceId:'checkout',title:'Saved Card Checkout',description:'Customer completes checkout with a saved card.',acceptanceCriteria:['Payment API returns 201'],manualTestSteps:[{order:1,action:'Open checkout'},{order:2,action:'Select saved card'}],expectedResults:['Payment succeeds'],tags:['@ui','@api'],feature:'Checkout',links:[]};}

async function tempRoot():Promise<string>{const root=await mkdtemp(join(tmpdir(),'app-knowledge-'));await mkdir(join(root,'src','applications','shop','pages'),{recursive:true});return root;}

test('knowledge approval survives unchanged observation but resets when learned evidence changes',async()=>{
  const root=await tempRoot(),store=new ApplicationKnowledgeStore(root);
  const base={id:'shop-checkout',kind:'page' as const,title:'Checkout',data:{route:'/checkout',buttons:['Pay Now']},learnedAt:new Date().toISOString(),source:'guided-learn',reviewRequired:true,application:'shop'};
  await store.save(base); await store.review(base.id,'APPROVED','qa-lead','validated');
  await store.save({...base,learnedAt:new Date().toISOString()});
  expect((await store.get(base.id))?.status).toBe('APPROVED');
  await store.save({...base,data:{route:'/checkout',buttons:['Place Order']},learnedAt:new Date().toISOString()});
  const changed=await store.get(base.id); expect(changed?.status).toBe('REVIEW_REQUIRED'); expect(changed?.revision).toBe(2);
});

test('only approved matching knowledge influences requirement analysis',async()=>{
  const root=await tempRoot(),store=new ApplicationKnowledgeStore(root),restore=saveEnv(['APP','APP_BASE_URL','ENV']); process.env.APP='shop'; process.env.ENV='qa';
  try{
    await store.save({id:'shop-checkout-page',kind:'page',title:'Saved Card Checkout',data:{buttons:['Pay Now'],route:'/checkout'},learnedAt:new Date().toISOString(),source:'guided-learn',reviewRequired:true,application:'shop'});
    let analysis=await analyzeRequirement(root,requirement());
    expect(analysis.applicationKnowledge?.some(item=>item.status==='REVIEW_REQUIRED')).toBe(true);
    expect(analysis.knowledgeGaps?.some(gap=>gap.includes('No approved UI'))).toBe(true);
    await store.review('shop-checkout-page','APPROVED','qa-lead');
    analysis=await analyzeRequirement(root,requirement());
    expect(analysis.applicationKnowledge?.some(item=>item.status==='APPROVED')).toBe(true);
    expect(analysis.knowledgeGaps?.some(gap=>gap.includes('No approved UI'))).toBe(false);
  }finally{restore();}
});

test('approved knowledge can be exported and imported without exporting review-required records',async()=>{
  const root=await tempRoot(),store=new ApplicationKnowledgeStore(root);
  await store.save({id:'approved-page',kind:'page',title:'Orders',data:{route:'/orders'},learnedAt:new Date().toISOString(),source:'safe-explorer',reviewRequired:true,application:'shop'});
  await store.save({id:'pending-page',kind:'page',title:'Admin',data:{route:'/admin'},learnedAt:new Date().toISOString(),source:'safe-explorer',reviewRequired:true,application:'shop'});
  await store.review('approved-page','APPROVED','qa-lead');
  const bundle=join(root,'application-knowledge','approved','shop.json'); await store.exportApproved('shop',bundle);
  const parsed=JSON.parse(await readFile(bundle,'utf8')) as {records:Array<{id:string}>}; expect(parsed.records.map(record=>record.id)).toEqual(['approved-page']);
  const second=await tempRoot(),secondStore=new ApplicationKnowledgeStore(second); expect(await secondStore.importApproved(bundle)).toBe(1); expect((await secondStore.get('approved-page'))?.status).toBe('APPROVED');
});

test('safe explorer follows only safe navigation and captures normalized same-origin API facts',async()=>{
  const root=await tempRoot(),restore=saveEnv(['APP','APP_BASE_URL','ENV','APPLICATION_EXPLORATION_ENABLED','EXPLORATION_MAX_PAGES','EXPLORATION_MAX_DEPTH','EXPLORATION_NAVIGATION_TIMEOUT_MS']);
  let server:Server|undefined;
  try{
    server=createServer((req,res)=>{
      if(req.url==='/api/orders/123'){res.setHeader('content-type','application/json');res.end('{"ok":true}');return;}
      if(req.url==='/products'){res.setHeader('content-type','text/html');res.end('<h1>Products</h1><a href="/">Home</a>');return;}
      if(req.url==='/delete-account'){res.setHeader('content-type','text/html');res.end('<h1>Danger</h1>');return;}
      res.setHeader('content-type','text/html');res.end('<h1>Shop Home</h1><button>Search</button><a href="/products">Products</a><a href="/delete-account">Delete account</a><script>fetch("/api/orders/123")</script>');
    });
    await new Promise<void>((resolve,reject)=>{server!.once('error',reject);server!.listen(0,'127.0.0.1',()=>resolve());});
    const address=server.address(); if(!address||typeof address==='string')throw new Error('Server address unavailable');
    const base=`http://127.0.0.1:${address.port}`; process.env.APP='shop';process.env.APP_BASE_URL=base;process.env.ENV='qa';process.env.APPLICATION_EXPLORATION_ENABLED='true';process.env.EXPLORATION_MAX_PAGES='5';process.env.EXPLORATION_MAX_DEPTH='2';process.env.EXPLORATION_NAVIGATION_TIMEOUT_MS='5000';
    const result=await safeExplore(root,base); expect(result.pages).toBe(2); expect(result.networkFacts).toBeGreaterThanOrEqual(1);
    const records=await new ApplicationKnowledgeStore(root).list();
    expect(records.some(record=>record.kind==='page'&&record.title==='Danger')).toBe(false);
    const api=records.find(record=>record.kind==='api'); expect(JSON.stringify(api?.data)).toContain('/api/orders/:id');
  }finally{await new Promise<void>(resolve=>server?server.close(()=>resolve()):resolve());restore();}
});

test('knowledge redaction and route normalization protect common secrets and dynamic IDs',()=>{
  expect(redactKnowledgeText('mail me at qa@example.com token eyJabc.def.ghi card 4111 1111 1111 1111')).not.toContain('qa@example.com');
  expect(redactKnowledgeText('mail me at qa@example.com token eyJabc.def.ghi card 4111 1111 1111 1111')).not.toContain('4111 1111 1111 1111');
  expect(normalizeRoutePath('/orders/12345/items/550e8400-e29b-41d4-a716-446655440000')).toBe('/orders/:id/items/:id');
});
