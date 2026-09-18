import { expect, test } from '@playwright/test';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ApplicationKnowledgeStore } from '../../src/framework/intelligence/knowledge/store.js';
import {
  approveExplorationProposal,
  generateExplorationProposal,
  promoteExplorationProposal,
  validateExplorationProposal,
} from '../../src/framework/intelligence/generation/exploration.proposal.js';

test.describe('unified exploration generation', () => {
  test.skip(process.env.RUN_FRAMEWORK_TESTS !== 'true', 'Framework contract test.');

  test('generates executable semantic text-entry flow with navigation and placeholder locator', async () => {
    const root = await mkdtemp(join(tmpdir(), 'testigent-ts-semantic-'));
    await mkdir(join(root, 'projects/demo/src'), { recursive: true });
    const store = new ApplicationKnowledgeStore(root);
    const now = new Date().toISOString();
    await store.save({
      id: 'demo-todo-journey', kind: 'journey', title: 'Create Todo Journey', learnedAt: now,
      source: 'guided-learn-v2', reviewRequired: true, application: 'demo', origin: 'https://demo.playwright.dev',
      data: { events: [
        { type:'navigation', at:now, pageId:'p1', urlPattern:'https://demo.playwright.dev/todomvc/', frames:[], target:{}, component:{type:'page'}, detail:{} },
        { type:'input', at:now, pageId:'p1', urlPattern:'https://demo.playwright.dev/todomvc/', frames:[], target:{tag:'input',role:'textbox',name:'What needs to be done?',inputType:'text',locatorCandidates:[{kind:'placeholder',value:'What needs to be done?',score:.88}]}, component:{type:'element'}, detail:{valuePresent:true} },
        { type:'key', at:now, pageId:'p1', urlPattern:'https://demo.playwright.dev/todomvc/', frames:[], target:{tag:'input',role:'textbox',name:'What needs to be done?',inputType:'text',locatorCandidates:[{kind:'placeholder',value:'What needs to be done?',score:.88}]}, component:{type:'element'}, detail:{key:'Enter'} },
      ] },
    });
    await store.review('demo-todo-journey', 'APPROVED', 'qa-lead');
    const requirement = { sourceType:'markdown' as const, sourceId:'todo-create', title:'Create Todo Item', description:'Create todo', acceptanceCriteria:['Todo is visible'], manualTestSteps:[], expectedResults:[], tags:[], links:[] };
    const manifest = await generateExplorationProposal(root, requirement, 'demo', 'demo-todo-journey');
    const pageEntry = manifest.files.find(file => file.target.includes('/src/pages/'))!;
    const pageSource = await readFile(join(root, pageEntry.staged), 'utf8');
    expect(pageSource).toContain(
      `await this.page.goto("/todomvc/", { waitUntil: 'domcontentloaded' })`,
    );
    expect(pageSource).toContain(`getByPlaceholder("What needs to be done?").fill(data.value1)`);
    expect(pageSource).toContain(`getByPlaceholder("What needs to be done?").press("Enter")`);
    expect(pageSource).toContain(`expect(this.page.getByText(data.value1, { exact: true })).toBeVisible()`);
    expect(pageSource).not.toContain(`getByRole("textbox", { name: "What needs to be done?" })`);
    const dataEntry = manifest.files.find(file => file.target.endsWith('/journey.json'))!;
    const data = JSON.parse(await readFile(join(root, dataEntry.staged), 'utf8')) as Record<string, unknown>;
    expect(data.value1).toBe('REVIEW_AND_SET_VALUE');
  });

  test('generates, validates, approves and promotes complex UI journey safely', async () => {
    const root = await mkdtemp(join(tmpdir(), 'testigent-ts-complex-'));
    await mkdir(join(root, 'projects/demo/src'), { recursive: true });
    const store = new ApplicationKnowledgeStore(root);
    const now = new Date().toISOString();
    await store.save({
      id: 'demo-payment-journey', kind: 'journey', title: 'Customer Payment', learnedAt: now,
      source: 'guided-learn-v2', reviewRequired: true, application: 'demo', origin: 'https://example.test',
      data: { events: [
        { type:'change', at:now, pageId:'p1', urlPattern:'https://example.test/customers', frames:[], target:{locatorCandidates:[{kind:'placeholder',value:'Search customers',score:.9}]}, component:{type:'element'}, detail:{} },
        { type:'click', at:now, pageId:'p1', urlPattern:'https://example.test/customers', frames:[], target:{locatorCandidates:[{kind:'role',role:'button',name:'Edit',value:'Edit',score:.95}]}, component:{type:'grid',framework:'ag-grid',table:{headers:['ID','Actions'],rowValues:['CUST-1034','Edit'],rowKey:'CUST-1034',columnIndex:1,columnHeader:'Actions',visibleRowCount:20,declaredRowCount:1000,virtualized:true}}, detail:{} },
        { type:'click', at:now, pageId:'p1', urlPattern:'https://example.test/checkout', frames:[{name:'payment',urlPattern:'https://pay.example/form',selector:'iframe[title="Secure payment"]',depth:1}], target:{locatorCandidates:[{kind:'role',role:'button',name:'Pay',value:'Pay',score:.95}]}, component:{type:'element',shadowHosts:[{tag:'secure-pay'}]}, detail:{}, correlatedNetwork:[{method:'POST',path:'/api/payments',status:201}] },
        { type:'file_upload', at:now, pageId:'p1', urlPattern:'https://example.test/checkout', frames:[], target:{locatorCandidates:[{kind:'testid',value:'invoice-upload',score:.99}]}, component:{type:'element'}, detail:{fileUpload:{count:1,extensions:['.pdf']}} },
        { type:'drag_start', at:now, pageId:'p1', urlPattern:'https://example.test/checkout', frames:[], target:{locatorCandidates:[{kind:'text',value:'Card A',score:.7}]}, component:{type:'element'}, detail:{} },
        { type:'drop', at:now, pageId:'p1', urlPattern:'https://example.test/checkout', frames:[], target:{locatorCandidates:[{kind:'text',value:'Done',score:.7}]}, component:{type:'element'}, detail:{} },
        { type:'scroll', at:now, pageId:'p1', urlPattern:'https://example.test/checkout', frames:[], target:{locatorCandidates:[{kind:'css',value:'html',score:.35}]}, component:{type:'element'}, detail:{scrollY:900} },
        { type:'click', at:now, pageId:'p1', urlPattern:'https://example.test/checkout', frames:[], target:{locatorCandidates:[{kind:'role',role:'button',name:'Receipt',value:'Receipt',score:.95}]}, component:{type:'element'}, detail:{} },
        { type:'page_opened', at:now, pageId:'p2', urlPattern:'https://example.test/receipt', frames:[], target:{}, component:{type:'page'}, detail:{openerPageId:'p1'} },
      ] },
    });
    await store.review('demo-payment-journey', 'APPROVED', 'qa-lead');
    const requirement = { sourceType:'markdown' as const, sourceId:'PAY-101', title:'Customer Payment', description:'Pay', acceptanceCriteria:['Payment succeeds'], manualTestSteps:[], expectedResults:[], tags:[], links:[] };
    const manifest = await generateExplorationProposal(root, requirement, 'demo', 'demo-payment-journey');
    const pageEntry = manifest.files.find(file => file.target.includes('/src/pages/'))!;
    const pageSource = await readFile(join(root, pageEntry.staged), 'utf8');
    for (const evidence of ['frameLocator', "getByRole('row').filter({ hasText: data.rowKey })", 'setInputFiles', 'dragTo', 'window.scrollTo', "waitForEvent('page')", 'Open Shadow DOM observed', 'Correlated network evidence']) expect(pageSource).toContain(evidence);
    expect((await validateExplorationProposal(root, 'PAY-101')).clean).toBe(false);
    const dataEntry = manifest.files.find(file => file.target.endsWith('/journey.json'))!;
    const dataPath = join(root, dataEntry.staged); const data = JSON.parse(await readFile(dataPath, 'utf8')) as Record<string, unknown>;
    for (const key of Object.keys(data)) data[key] = Array.isArray(data[key]) ? ['tests/fixtures/invoice.pdf'] : 'CUST-1034';
    await writeFile(dataPath, JSON.stringify(data, null, 2) + '\n');
    expect((await validateExplorationProposal(root, 'PAY-101')).clean).toBe(true);
    await approveExplorationProposal(root, 'PAY-101', 'qa-lead');
    await promoteExplorationProposal(root, 'PAY-101');
    const promotedTest = await readFile(join(root, 'projects/demo/tests/e2e/customer_payment.spec.ts'), 'utf8');
    expect(promotedTest).toContain('HUMAN-APPROVED GENERATED AUTOMATION');
    expect(promotedTest).toContain('@generated-approved');
    expect(promotedTest).not.toContain('@generated-review');
  });
});


test('proposal validator rejects incomplete and inconsistent journey data', async () => {
  test.skip(
    process.env.RUN_FRAMEWORK_TESTS !== 'true',
    'Framework contract test.',
  );

  const root = await mkdtemp(
    join(tmpdir(), 'testigent-validator-contract-'),
  );

  try {
    await mkdir(
      join(root, 'projects/demo/src'),
      { recursive: true },
    );

    const store = new ApplicationKnowledgeStore(root);
    const now = new Date().toISOString();

    await store.save({
      id: 'demo-validator-journey',
      kind: 'journey',
      title: 'Create Todo Journey',
      learnedAt: now,
      source: 'guided-learn-v2',
      reviewRequired: true,
      application: 'demo',
      origin: 'https://demo.playwright.dev',
      data: {
        events: [
          {
            type: 'navigation',
            at: now,
            pageId: 'p1',
            urlPattern:
              'https://demo.playwright.dev/todomvc/',
            frames: [],
            target: {},
            component: { type: 'page' },
            detail: {},
          },
          {
            type: 'input',
            at: now,
            pageId: 'p1',
            urlPattern:
              'https://demo.playwright.dev/todomvc/',
            frames: [],
            target: {
              tag: 'input',
              role: 'textbox',
              inputType: 'text',
              locatorCandidates: [
                {
                  kind: 'placeholder',
                  value: 'What needs to be done?',
                  score: 0.88,
                },
              ],
            },
            component: { type: 'element' },
            detail: {
              valuePresent: true,
            },
          },
          {
            type: 'key',
            at: now,
            pageId: 'p1',
            urlPattern:
              'https://demo.playwright.dev/todomvc/',
            frames: [],
            target: {
              tag: 'input',
              role: 'textbox',
              inputType: 'text',
              locatorCandidates: [
                {
                  kind: 'placeholder',
                  value: 'What needs to be done?',
                  score: 0.88,
                },
              ],
            },
            component: { type: 'element' },
            detail: {
              key: 'Enter',
            },
          },
        ],
      },
    });

    await store.review(
      'demo-validator-journey',
      'APPROVED',
      'qa-lead',
    );

    const requirement = {
      sourceType: 'markdown' as const,
      sourceId: 'todo-validator',
      title: 'Create Todo Item',
      description: 'Create todo',
      acceptanceCriteria: [
        'Todo is visible',
      ],
      manualTestSteps: [],
      expectedResults: [],
      tags: [],
      links: [],
    };

    const manifest = await generateExplorationProposal(
      root,
      requirement,
      'demo',
      'demo-validator-journey',
    );

    const dataFile = manifest.files.find(
      file =>
        file.target.endsWith('/journey.json'),
    );

    expect(dataFile).toBeTruthy();

    const dataPath = join(
      root,
      dataFile!.staged,
    );

    // Generated placeholder must block approval.
    let result =
      await validateExplorationProposal(
        root,
        'todo-validator',
      );

    expect(result.clean).toBe(false);
    expect(result.findings.join('\n')).toContain(
      'Replace review placeholders',
    );

    // Valid value + unused field must fail.
    await writeFile(
      dataPath,
      JSON.stringify(
        {
          value1: 'Testigent AI Todo',
          unusedExtra: 'must fail',
        },
        null,
        2,
      ) + '\n',
    );

    result =
      await validateExplorationProposal(
        root,
        'todo-validator',
      );

    expect(result.clean).toBe(false);
    expect(result.findings.join('\n')).toContain(
      "Unused journey data key 'unusedExtra'",
    );

    // Missing required generated data must fail.
    await writeFile(
      dataPath,
      JSON.stringify({}, null, 2) + '\n',
    );

    result =
      await validateExplorationProposal(
        root,
        'todo-validator',
      );

    expect(result.clean).toBe(false);
    expect(result.findings.join('\n')).toContain(
      "Missing journey data key 'value1'",
    );

    // Invalid JSON must fail.
    await writeFile(
      dataPath,
      '{ invalid-json\n',
    );

    result =
      await validateExplorationProposal(
        root,
        'todo-validator',
      );

    expect(result.clean).toBe(false);
    expect(result.findings.join('\n')).toContain(
      'Invalid JSON',
    );

    // Correct reviewed data must pass.
    await writeFile(
      dataPath,
      JSON.stringify(
        {
          value1: 'Testigent AI Todo',
        },
        null,
        2,
      ) + '\n',
    );

    result =
      await validateExplorationProposal(
        root,
        'todo-validator',
      );

    expect(result.clean).toBe(true);
    expect(result.findings).toEqual([]);
  } finally {
    await rm(root, {
      recursive: true,
      force: true,
    });
  }
});
