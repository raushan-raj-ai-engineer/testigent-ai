import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { buildExecutionFacts } from '../../src/framework/analytics/execution-facts';
import type { BusinessTestResult, HealingSummary } from '../../src/framework/analytics/report.types';
import { classifyTestLayers } from '../../src/framework/analytics/test-layer.classifier';
import { writeBusinessDashboard } from '../../src/framework/reporting/business-dashboard.writer';

/**
 * Author: Raushan Raj
 * Business Use: Browser-level regression test for filters, graphs, Print/PDF trigger, CSV export and test-step drill-down.
 * How to use: Run `npm run test:dashboard:interactive` after dashboard/reporting changes.
 * Benefit: Prevents a visually correct but non-interactive dashboard from being released to business users.
 */
test('interactive dashboard filters, buttons, graphs and test-step details work over HTTP', async ({ page }) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'enterprise-dashboard-v3-'));
  const facts = buildExecutionFacts({
    runId: 'dashboard-v3', environment: 'qa', application: 'orders', healing: noHealing(),
    scope: { excludedInternalTests: 5, internalTestsIncluded: false },
    results: [
      sample('1', 'Checkout succeeds @ui @api @critical', 'passed', ['@ui','@api','@critical'], '/tests/e2e/checkout.spec.ts'),
      sample('2', 'Create order API returns correct validation @api', 'failed', ['@api'], '/tests/api/order.spec.ts', 'PRODUCT_DEFECT'),
      sample('3', 'Order record persists @db', 'skipped', ['@db'], '/tests/database/order.spec.ts')
    ]
  });
  writeBusinessDashboard(dir, facts, { history: [
    { runId:'r1', generatedAt:'2026-09-01T00:00:00Z', environment:'qa', application:'orders', total:3, passed:2, failed:1, passRate:66.67, flaky:0, healed:0 },
    { runId:'r2', generatedAt:'2026-09-02T00:00:00Z', environment:'qa', application:'orders', total:3, passed:1, failed:1, passRate:33.33, flaky:0, healed:0 }
  ]});
  const server = await serve(dir);
  try {
    await page.addInitScript(() => { (window as Window & { __printCalled?: boolean }).__printCalled = false; window.print = () => { (window as Window & { __printCalled?: boolean }).__printCalled = true; }; });
    await page.goto(server.url);
    await expect(page.locator('#dashboardJsStatus')).toHaveText('Interactive controls ready');
    await expect(page.locator('#statusDonut .status-donut-svg')).toBeVisible();
    await expect(page.locator('#statusDonut .donut-segment')).toHaveCount(3);
    await expect(page.locator('#layerBars .bar-row')).toHaveCount(4);
    await expect(page.locator('#trendChart')).toBeVisible();
    await expect(page.locator('.test-row:not([hidden])')).toHaveCount(3);

    await page.locator('#statusFilter').selectOption('failed');
    await expect(page.locator('.test-row:not([hidden])')).toHaveCount(1);
    await expect(page.locator('#filteredFail')).toHaveText('Fail 1');

    await page.locator('#resetBtn').click();
    await page.locator('#layerFilter').selectOption('api');
    await expect(page.locator('.test-row:not([hidden])')).toHaveCount(2);

    await page.locator('#resetBtn').click();
    await page.locator('#tagFilter').selectOption('@critical');
    await expect(page.locator('.test-row:not([hidden])')).toHaveCount(1);

    await page.locator('#resetBtn').click();
    await page.locator('#searchFilter').fill('order record');
    await expect(page.locator('.test-row:not([hidden])')).toHaveCount(1);

    await page.locator('#resetBtn').click();
    const details = page.locator('.scenario-details').first();
    await page.locator('#expandBtn').click();
    await expect(details).toHaveAttribute('open', '');
    await expect(details.locator('.step-title')).toContainText(['Create customer test data', 'Customer places order']);
    await expect(details.locator('.step-duration')).toHaveCount(2);
    await page.locator('#collapseBtn').click();
    await expect(details).not.toHaveAttribute('open', '');
    await details.locator('summary').click();
    await expect(details).toHaveAttribute('open', '');

    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('#statusDonut .status-donut-svg')).toBeVisible();
    await expect(page.locator('#statusLegend')).toContainText('Passed');
    await expect(page.locator('#statusLegend')).toContainText('Failed');
    await expect(page.locator('#statusLegend')).toContainText('Skipped');
    await expect(page.locator('.scenario-details').first()).toBeVisible();
    await page.emulateMedia({ media: 'screen' });

    await page.locator('#printBtn').click();
    await expect.poll(() => page.evaluate(() => Boolean((window as Window & { __printCalled?: boolean }).__printCalled))).toBe(true);

    const downloadPromise = page.waitForEvent('download');
    await page.locator('#exportBtn').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('filtered-business-tests.csv');
  } finally {
    await server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function sample(testId:string,title:string,status:'passed'|'failed'|'skipped',tags:string[],sourceFile:string,failureCategory?:BusinessTestResult['failureCategory']):BusinessTestResult {
  const classification=classifyTestLayers(tags,sourceFile);
  return {
    testId,title,project:'chromium',status,rawStatus:status,durationMs:650,totalDurationMs:650,retriesUsed:0,flaky:false,tags,
    steps:['Create customer test data','Customer places order'],
    stepDetails:[
      { title:'Create customer test data',category:'test.step',durationMs:120,status:'passed',children:[] },
      { title:'Customer places order',category:'test.step',durationMs:530,status:status==='failed'?'failed':'passed',error:status==='failed'?'Expected 201 but received 500':undefined,children:[] }
    ],
    error:status==='failed'?'Expected 201 but received 500':undefined,failureCategory,
    attempts:[{retry:0,status,durationMs:650,failureCategory}],sourceFile,...classification
  };
}
function noHealing():HealingSummary{return {count:0,fallback:0,cache:0,ai:0,affectedTests:0,records:[]};}
function serve(root:string):Promise<{url:string;close:()=>Promise<void>}>{return new Promise((resolve,reject)=>{const server=http.createServer((req,res)=>{const target=path.join(root,req.url==='/'?'index.html':String(req.url).replace(/^\//,''));if(!fs.existsSync(target)){res.writeHead(404);res.end();return;}const ext=path.extname(target);res.setHeader('Content-Type',ext==='.js'?'text/javascript':ext==='.csv'?'text/csv':'text/html');fs.createReadStream(target).pipe(res);});server.once('error',reject);server.listen(0,'127.0.0.1',()=>{const address=server.address();if(!address||typeof address==='string')return reject(new Error('No server address'));resolve({url:`http://127.0.0.1:${address.port}/`,close:()=>new Promise<void>((r,j)=>server.close(e=>e?j(e):r()))});});});}
