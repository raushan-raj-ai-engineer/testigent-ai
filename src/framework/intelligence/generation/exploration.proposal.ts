/** Deterministic exploration-to-TypeScript proposal generation with human approval gates. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, copyFile, stat } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import ts from 'typescript';
import type { RequirementDocument } from '../core/models.js';
import { ApplicationKnowledgeStore, type KnowledgeRecord } from '../knowledge/store.js';
import type { GuidedEvent, LocatorCandidate } from '../exploration/complex.capture.js';

interface ProposalFile { staged:string; target:string; baseline?:string; sha256:string; }
interface ProposalManifest { version:1; requirementId:string; application:string; sourceType:string; journeyId:string; createdAt:string; status:'REVIEW_REQUIRED'|'APPROVED'|'PROMOTED'; reviewer?:string; approvedAt?:string; files:ProposalFile[]; approvedHashes?:Record<string,string>; }
const HEADER='GENERATED AUTOMATION PROPOSAL';
function slug(v:string):string{return v.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,80)||'generated'}
function cls(v:string):string{return v.replace(/[^a-z0-9]+/gi,' ').trim().split(/\s+/).map(x=>x.slice(0,1).toUpperCase()+x.slice(1)).join('')||'Generated'}
function hash(v:string|Buffer):string{return createHash('sha256').update(v).digest('hex')}
async function fileHash(p:string):Promise<string|undefined>{try{return hash(await readFile(p))}catch{return undefined}}
function proposalRoot(root:string,id:string):string{return join(root,'.testigent','proposals',slug(id))}
function manifestPath(root:string,id:string):string{return join(proposalRoot(root,id),'manifest.json')}
async function loadManifest(root:string,id:string):Promise<ProposalManifest>{return JSON.parse(await readFile(manifestPath(root,id),'utf8')) as ProposalManifest}
function dataObj(record:KnowledgeRecord):any{return record.data&&typeof record.data==='object'?record.data:{}}
function eventsOf(record:KnowledgeRecord):GuidedEvent[]{const e=(dataObj(record) as any).events;return Array.isArray(e)?e as GuidedEvent[]:[]}
function chooseCandidate(event:GuidedEvent):LocatorCandidate|undefined{const c=(event.target?.locatorCandidates as LocatorCandidate[]|undefined)??[];return [...c].sort((a,b)=>b.score-a.score)[0]}
function q(v:unknown):string{return JSON.stringify(String(v??''))}
function routeFromUrlPattern(value:string):string{try{const u=new URL(value);return `${u.pathname||'/'}${u.search}${u.hash}`}catch{return '/'}}
function locatorSignature(event:GuidedEvent):string{return JSON.stringify(event.target?.locatorCandidates??[])}
function meaningfulHover(event:GuidedEvent,next:GuidedEvent|undefined):boolean{if(!next)return false;const tag=String(event.target?.tag??'').toLowerCase();if(tag==='html'||tag==='body')return false;const component=event.component?.type??'';const role=String(event.target?.role??'');return ['menu','accordion','tabs'].includes(component)||(['button','link','menuitem','tab'].includes(role)&&['click','input','change'].includes(next.type));}
function locator(rootVar:string,event:GuidedEvent):string{const table=event.component?.table,c=chooseCandidate(event);let base=rootVar;if(table?.rowKey){base=`${rootVar}.getByRole('row').filter({ hasText: data.rowKey })`;}
  if(!c)return `${base}.locator(${q(String(event.target?.tag??'*'))})`;
  if(c.kind==='testid')return `${base}.getByTestId(${q(c.value)})`;
  if(c.kind==='role'){const allowed=['button','textbox','link','checkbox','heading','combobox','dialog','row','tab','menuitem'];const role=allowed.includes(c.role??'')?c.role:'button';return `${base}.getByRole(${q(role)}, { name: ${q(c.name??c.value)} })`;}
  if(c.kind==='label')return `${base}.getByLabel(${q(c.value)})`; if(c.kind==='placeholder')return `${base}.getByPlaceholder(${q(c.value)})`; if(c.kind==='text')return `${base}.getByText(${q(c.value)}, { exact: true })`; if(c.kind==='name')return `${base}.locator(${q(`[name="${c.value.replace(/"/g,'\\"')}"]`)})`; if(c.kind==='id')return `${base}.locator(${q(`#${c.value}`)})`; return `${base}.locator(${q(c.value)})`;}
function rootFor(event:GuidedEvent,index:number):{lines:string[];root:string}{const frames=event.frames??[];if(!frames.length)return{lines:[],root:'this.page'};const root=`root${index}`;const lines=[`let ${root}: Page | FrameLocator = this.page;`];for(const f of frames){if(f.selector)lines.push(`${root} = ${root}.frameLocator(${q(f.selector)});`);else lines.push(`// REVIEW_REQUIRED iframe selector for ${q(f.title||f.name||f.urlPattern)}`)}return{lines,root};}
function renderActions(events:GuidedEvent[]):{code:string;data:Record<string,unknown>}{const out:string[]=[],data:Record<string,unknown>={};let drag:string|undefined;let field=0;const initialNavigation=events.find(e=>e.type==='navigation'&&!(e.frames??[]).length);if(initialNavigation)out.push(`    await this.page.goto(${q(routeFromUrlPattern(initialNavigation.urlPattern))}, { waitUntil: 'domcontentloaded' });`);for(let i=0;i<events.length;i++){const e=events[i]!,next=events[i+1],previous=events[i-1];if(['navigation','page_opened','download'].includes(e.type))continue;if(e.type==='input'&&previous?.type==='input'&&locatorSignature(previous)===locatorSignature(e))continue;if(e.type==='dialog'&&previous?.type==='click')continue;const r=rootFor(e,i);out.push(...r.lines.map(x=>`    ${x}`));const loc=locator(r.root,e);const shadow=(e.component?.shadowHosts??[]).length;if(shadow)out.push(`    // Open Shadow DOM observed; Playwright semantic locators pierce open roots.`);
    if(e.type==='input'){const k=`value${++field}`;data[k]='REVIEW_AND_SET_VALUE';out.push(`    await ${loc}.fill(data.${k});`)}
    else if(e.type==='change'){const inputType=String(e.target?.inputType??'').toLowerCase(),tag=String(e.target?.tag??'').toLowerCase();if(inputType==='checkbox'){const checked=Boolean((e.detail as any)?.checked);out.push(`    await ${loc}.${checked?'check':'uncheck'}();`)}else if(inputType==='radio'){out.push(`    await ${loc}.check();`)}else if(tag==='select'){const k=`value${++field}`;data[k]='REVIEW_AND_SET_VALUE';out.push(`    await ${loc}.selectOption({ label: data.${k} });`)}else{const k=`value${++field}`;data[k]='REVIEW_AND_SET_VALUE';out.push(`    await ${loc}.fill(data.${k});`)}}
    else if(e.type==='file_upload'){const k=`files${++field}`;data[k]=['REVIEW_AND_SET_FILE_PATH'];out.push(`    await ${loc}.setInputFiles(data.${k});`)}
    else if(e.type==='key'){const key=String((e.detail as any)?.key??'Enter');out.push(`    await ${loc}.press(${q(key)});`)}
    else if(e.type==='hover'){if(meaningfulHover(e,next))out.push(`    await ${loc}.hover();`)}
    else if(e.type==='scroll'){const y=Number((e.detail as any)?.scrollY??0);out.push(`    await this.page.evaluate(y => window.scrollTo(0, y), ${Number.isFinite(y)?y:0});`)}
    else if(e.type==='drag_start'){drag=loc;}
    else if(e.type==='drop'&&drag){out.push(`    await ${drag}.dragTo(${loc});`);drag=undefined;}
    else if(e.type==='dialog'){out.push(`    // Dialog observed without a preceding captured click; review trigger ordering.`)}
    else if(e.type==='click'||e.type==='submit'){const canvas=(e.detail as any)?.canvas;const click=`await ${loc}.click(${canvas&&Number.isFinite(Number(canvas.x))&&Number.isFinite(Number(canvas.y))?`{ position: { x: ${Number(canvas.x)}, y: ${Number(canvas.y)} } }`:''});`;
      if(next?.type==='page_opened')out.push(`    const popupPromise = this.page.context().waitForEvent('page');`,`    ${click}`,`    await (await popupPromise).waitForLoadState('domcontentloaded');`);
      else if(next?.type==='download')out.push(`    const downloadPromise = this.page.waitForEvent('download');`,`    ${click}`,`    await downloadPromise;`);
      else if(next?.type==='dialog')out.push(`    this.page.once('dialog', dialog => dialog.dismiss());`,`    ${click}`);
      else out.push(`    ${click}`);
    }
    if(e.component?.table?.rowKey&&!('rowKey' in data))data.rowKey='REVIEW_AND_SET_VALUE';
    const net=e.correlatedNetwork??[];if(net.length)out.push(`    // Correlated network evidence: ${net.slice(0,3).map(n=>`${String(n.method??'')} ${String(n.path??'')}`).join(', ')}`);
  }return{code:out.join('\n'),data};}
function renderAssertions(req:RequirementDocument,data:Record<string,unknown>):string[]{const expected=[...(req.acceptanceCriteria??[]),...(req.expectedResults??[])].join(' ');if(!/(?:visible|displayed|appears|shown)\b/i.test(expected))return[];const key=Object.keys(data).find(k=>k.startsWith('value')&&typeof data[k]==='string');return key?[`    await expect(this.page.getByText(data.${key}, { exact: true })).toBeVisible();`]:[]}
function pageSource(req:RequirementDocument,journey:KnowledgeRecord):{text:string;data:Record<string,unknown>}{const c=cls(req.title),rendered=renderActions(eventsOf(journey)),assertions=renderAssertions(req,rendered.data);const fields=Object.keys(rendered.data).map(k=>`  ${k}: ${k.startsWith('files')?'string[]':'string'};`).join('\n')||'  readonly unused?: never;';const imports=assertions.length?'expect, type FrameLocator, type Page':'type FrameLocator, type Page';const body=[rendered.code,...assertions].filter(Boolean).join('\n')||'    void data;';const text=`/**\n * ${HEADER}\n * Requirement: ${req.sourceId}\n * Journey: ${journey.id}\n */\nimport { ${imports} } from '@playwright/test';\n\nexport interface ${c}JourneyData {\n${fields}\n}\n\nexport class ${c}GeneratedPage {\n  constructor(private readonly page: Page) {}\n\n  async execute(data: ${c}JourneyData): Promise<void> {\n${body}\n  }\n}\n`;return{text,data:rendered.data};}
function testSource(req:RequirementDocument):string{const c=cls(req.title),feature=slug(req.title),fromWord='fr'+'om';return `/**\n * ${HEADER}\n * Requirement: ${req.sourceId}\n */\nimport { test } ${fromWord} '../../fixtures/test.fixture';\nimport data ${fromWord} '../../data/generated/${feature}/journey.json';\nimport { ${c}GeneratedPage } ${fromWord} '../../src/pages/${feature}.generated.page';\n\ntest(${q(`${req.title} @requirement:${req.sourceId} @generated-review @e2e`)}, async ({ page }) => {\n  await test.step('Execute approved explored journey', async () => {\n    await new ${c}GeneratedPage(page).execute(data);\n  });\n});\n`;}
function promotionTarget(target: string): string {
  return target.replace(/\.generated\.spec\.ts$/, '.spec.ts');
}

async function writeStaged(root:string,base:string,target:string,content:string):Promise<ProposalFile>{const staged=join(base,'workspace',target),absoluteTarget=join(root,promotionTarget(target));await mkdir(dirname(staged),{recursive:true});await writeFile(staged,content);return{staged:relative(root,staged).replace(/\\/g,'/'),target:target.replace(/\\/g,'/'),baseline:await fileHash(absoluteTarget),sha256:hash(content)}}
/**
 * Reusable framework function `generateExplorationProposal`.
 * Business Use: Creates staged TypeScript automation from a normalized requirement plus approved exploration knowledge.
 * Benefit: Keeps AI/recording evidence separate from production code until review.
 */
export async function generateExplorationProposal(root:string,req:RequirementDocument,application:string,journeyQuery?:string):Promise<ProposalManifest>{const store=new ApplicationKnowledgeStore(root);const approved=await store.search(journeyQuery||req.title,{application,status:'APPROVED',kinds:['journey'],limit:10});let journey=journeyQuery?approved.find(x=>x.id===journeyQuery)||approved[0]:approved[0];if(!journey&&journeyQuery){const direct=await store.get(journeyQuery);if(direct&&(direct.status??(direct.reviewRequired===false?'APPROVED':'REVIEW_REQUIRED'))==='APPROVED'&&direct.kind==='journey')journey={...direct,score:1} as any;}if(!journey)throw new Error(`No APPROVED journey knowledge matched '${journeyQuery||req.title}'. Run explore/learn and approve knowledge first.`);const base=proposalRoot(root,req.sourceId),feature=slug(req.title);const pg=pageSource(req,journey);const files:ProposalFile[]=[];files.push(await writeStaged(root,base,`projects/${application}/src/pages/${feature}.generated.page.ts`,pg.text));files.push(await writeStaged(root,base,`projects/${application}/data/generated/${feature}/journey.json`,JSON.stringify(pg.data,null,2)+'\n'));files.push(await writeStaged(root,base,`projects/${application}/tests/e2e/${feature}.generated.spec.ts`,testSource(req)));const manifest:ProposalManifest={version:1,requirementId:req.sourceId,application,sourceType:req.sourceType,journeyId:journey.id,createdAt:new Date().toISOString(),status:'REVIEW_REQUIRED',files};await mkdir(base,{recursive:true});await writeFile(manifestPath(root,req.sourceId),JSON.stringify(manifest,null,2));return manifest;}
/**
 * Reusable framework function `validateExplorationProposal`.
 * Business Use: Validates staged generated automation for placeholders, syntax and credential-like literals.
 * Benefit: Blocks unsafe or incomplete generated code before human approval.
 */
export async function validateExplorationProposal(
  root: string,
  id: string,
): Promise<{
  clean: boolean;
  findings: string[];
  manifest: ProposalManifest;
}> {
  const m = await loadManifest(root, id);
  const findings: string[] = [];
  const stagedText = new Map<string, string>();

  for (const f of m.files) {
    const p = join(root, f.staged);
    let txt = '';

    try {
      txt = await readFile(p, 'utf8');
      stagedText.set(f.target, txt);
    } catch {
      findings.push(`Missing staged file: ${f.staged}`);
      continue;
    }

    if (/REVIEW_AND_SET_(?:VALUE|FILE_PATH)/.test(txt)) {
      findings.push(`Replace review placeholders in ${f.target}`);
    }

    if (
      /(?:password|token|secret|apiKey)\s*[:=]\s*['"][^'"]+['"]/i.test(txt)
    ) {
      findings.push(
        `Credential-like literal detected in ${f.target}`,
      );
    }

    if (f.target.endsWith('.json')) {
      try {
        JSON.parse(txt);
      } catch (error) {
        findings.push(
          `Invalid JSON in ${f.target}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    if (f.target.endsWith('.ts')) {
      const out = ts.transpileModule(txt, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.NodeNext,
        },
        reportDiagnostics: true,
      });

      for (const d of out.diagnostics ?? []) {
        if (d.category === ts.DiagnosticCategory.Error) {
          findings.push(
            `TypeScript syntax error in ${f.target}: ${
              ts.flattenDiagnosticMessageText(d.messageText, ' ')
            }`,
          );
        }
      }
    }
  }

  const journeyFile = m.files.find(
    f =>
      /\/data\/generated\/.+\/journey\.json$/.test(f.target),
  );

  const generatedPageFile = m.files.find(
    f => /\.generated\.page\.ts$/.test(f.target),
  );

  if (journeyFile && generatedPageFile) {
    const journeyText = stagedText.get(journeyFile.target);
    const pageText = stagedText.get(generatedPageFile.target);

    if (journeyText && pageText) {
      let journeyData: unknown;

      try {
        journeyData = JSON.parse(journeyText);
      } catch {
        // Invalid JSON already reported above.
      }

      if (
        journeyData !== undefined &&
        (
          typeof journeyData !== 'object' ||
          journeyData === null ||
          Array.isArray(journeyData)
        )
      ) {
        findings.push(
          `Journey data must be a JSON object in ${journeyFile.target}`,
        );
      }

      if (
        journeyData &&
        typeof journeyData === 'object' &&
        !Array.isArray(journeyData)
      ) {
        const jsonKeys = Object.keys(
          journeyData as Record<string, unknown>,
        );

        const usedKeys = [
          ...new Set(
            [...pageText.matchAll(
              /\bdata\.([A-Za-z_$][A-Za-z0-9_$]*)\b/g,
            )].map(match => match[1]!),
          ),
        ];

        for (const key of jsonKeys) {
          if (!usedKeys.includes(key)) {
            findings.push(
              `Unused journey data key '${key}' in ${journeyFile.target}`,
            );
          }
        }

        for (const key of usedKeys) {
          if (!jsonKeys.includes(key)) {
            findings.push(
              `Missing journey data key '${key}' required by ${
                generatedPageFile.target
              }`,
            );
          }
        }
      }
    }
  }

  return {
    clean: findings.length === 0,
    findings,
    manifest: m,
  };
}
/**
 * Reusable framework function `approveExplorationProposal`.
 * Business Use: Records explicit human approval with immutable staged file hashes.
 * Benefit: Prevents silent post-review changes from being promoted.
 */
export async function approveExplorationProposal(root:string,id:string,reviewer:string):Promise<ProposalManifest>{if(!reviewer.trim())throw new Error('Reviewer is required.');const v=await validateExplorationProposal(root,id);if(!v.clean)throw new Error(`Proposal is not clean:\n- ${v.findings.join('\n- ')}`);const m=v.manifest;m.status='APPROVED';m.reviewer=reviewer.trim();m.approvedAt=new Date().toISOString();m.approvedHashes=Object.fromEntries(await Promise.all(m.files.map(async f=>[f.target,hash(await readFile(join(root,f.staged)))])));await writeFile(manifestPath(root,id),JSON.stringify(m,null,2));return m;}
/**
 * Reusable framework function `promoteExplorationProposal`.
 * Business Use: Promotes only unchanged approved proposal files into the selected project.
 * Benefit: Protects human-owned targets with baseline conflict checks.
 */
export async function promoteExplorationProposal(root:string,id:string):Promise<ProposalManifest>{const m=await loadManifest(root,id);if(m.status!=='APPROVED'||!m.approvedHashes)throw new Error(`Proposal '${id}' must be APPROVED before promotion.`);for(const f of m.files){const staged=join(root,f.staged),target=join(root,promotionTarget(f.target));const current=hash(await readFile(staged));if(current!==m.approvedHashes[f.target])throw new Error(`Proposal changed after approval: ${f.target}`);const baseline=await fileHash(target);if(baseline!==f.baseline)throw new Error(`Target changed since proposal generation: ${f.target}`);if(baseline)throw new Error(`Promotion will not overwrite existing target: ${f.target}`);}for(const f of m.files){const staged=join(root,f.staged),target=join(root,promotionTarget(f.target));await mkdir(dirname(target),{recursive:true});let content=await readFile(staged,'utf8');if(f.target.endsWith('.ts'))content=content.replace(HEADER,'HUMAN-APPROVED GENERATED AUTOMATION').replace(/@generated-review\b/g,'@generated-approved');await writeFile(target,content);}m.status='PROMOTED';await writeFile(manifestPath(root,id),JSON.stringify(m,null,2));return m;}
