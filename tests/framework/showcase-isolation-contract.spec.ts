import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { analyzeFailureIntelligence } from '../../src/framework/failure-intelligence/failure-analyzer.js';
import { validateShowcaseDataset, type ShowcaseDataset } from '../../src/framework/failure-intelligence/showcase-policy.js';
import { renderCustomerShowcaseHtml } from '../../src/framework/reporting/customer-showcase.renderer.js';
import { renderFailureIntelligenceHtml } from '../../src/framework/reporting/failure-intelligence.renderer.js';

test.describe('Customer showcase isolation contract', () => {
  test('ships 5-10 realistic examples that can never become product claims', () => {
    const dataset = JSON.parse(fs.readFileSync(path.resolve('showcase/customer-demo.json'), 'utf8')) as ShowcaseDataset;
    expect(() => validateShowcaseDataset(dataset)).not.toThrow();
    expect(dataset.scenarios.length).toBeGreaterThanOrEqual(5);
    expect(dataset.scenarios.length).toBeLessThanOrEqual(10);
    const summary = analyzeFailureIntelligence(dataset.scenarios);
    expect(summary.claimEligible).toBe(false);
    expect(summary.evidenceMode).toBe('SHOWCASE');
    expect(summary.uniqueIncidents).toBeLessThan(summary.analyzedScenarios);
    expect(summary.unknownScenarios).toBeGreaterThan(0);
  });

  test('renders an unmistakable synthetic banner and populated intelligence instead of empty cards', () => {
    const dataset = JSON.parse(fs.readFileSync(path.resolve('showcase/customer-demo.json'), 'utf8')) as ShowcaseDataset;
    const summary = analyzeFailureIntelligence(dataset.scenarios);
    const html = renderCustomerShowcaseHtml(dataset, summary);
    expect(html).toContain('SHOWCASE MODE · SYNTHETIC DATA');
    expect(html).toContain('claimEligible = false');
    expect(html).toContain('Failure Intelligence');
    expect(html).toContain('Pilot Intelligence');
    expect(html).toContain('Plain baseline comparison');
    expect(html).toContain('OpenAPI Intelligence');
    expect(html).toContain('Safe recovery');
    expect(html).toContain('AGENTIC / MCP');
    expect(renderFailureIntelligenceHtml(summary, { showcase: true })).toContain('not customer execution data');
  });

  test('rejects any attempt to mark showcase or synthetic evidence claim eligible', () => {
    const dataset = JSON.parse(fs.readFileSync(path.resolve('showcase/customer-demo.json'), 'utf8')) as ShowcaseDataset;
    expect(() => validateShowcaseDataset({ ...dataset, claimEligible: true } as unknown as ShowcaseDataset)).toThrow(/SHOWCASE_TRUST_BOUNDARY/);
    const corrupted = structuredClone(dataset) as ShowcaseDataset;
    corrupted.scenarios[0] = { ...corrupted.scenarios[0]!, claimEligible: true };
    expect(() => validateShowcaseDataset(corrupted)).toThrow(/SHOWCASE_SCENARIO_TRUST_BOUNDARY/);
  });
});
