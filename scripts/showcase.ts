import fs from 'node:fs';
import path from 'node:path';
import { analyzeFailureIntelligence } from '../src/framework/failure-intelligence/failure-analyzer.js';
import { validateShowcaseDataset, type ShowcaseDataset } from '../src/framework/failure-intelligence/showcase-policy.js';
import { renderCustomerShowcaseHtml } from '../src/framework/reporting/customer-showcase.renderer.js';
import { renderFailureIntelligenceHtml } from '../src/framework/reporting/failure-intelligence.renderer.js';

const root = process.cwd();
const source = path.resolve(root, process.env.SHOWCASE_DATASET ?? 'showcase/customer-demo.json');
if (!fs.existsSync(source)) throw new Error(`Showcase dataset not found: ${source}`);
const dataset = JSON.parse(fs.readFileSync(source, 'utf8')) as ShowcaseDataset;
validateShowcaseDataset(dataset);
const summary = analyzeFailureIntelligence(dataset.scenarios);
if (summary.claimEligible) throw new Error('SHOWCASE_CLAIM_BOUNDARY: showcase analysis unexpectedly became claim-eligible.');
if (process.argv.includes('validate')) {
  console.log(JSON.stringify({ ok: true, mode: dataset.mode, scenarios: dataset.scenarios.length, uniqueIncidents: summary.uniqueIncidents, claimEligible: summary.claimEligible, unknown: summary.unknownScenarios }, null, 2));
  process.exit(0);
}
const outputDir = path.resolve(root, process.env.SHOWCASE_OUTPUT_DIR ?? 'reports/showcase/customer-demo');
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'index.html'), renderCustomerShowcaseHtml(dataset, summary), 'utf8');
fs.writeFileSync(path.join(outputDir, 'failure-intelligence.html'), renderFailureIntelligenceHtml(summary, { showcase: true, backHref: './index.html' }), 'utf8');
fs.writeFileSync(path.join(outputDir, 'showcase-data.json'), `${JSON.stringify({ dataset, failureIntelligence: summary }, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ ok: true, mode: 'SHOWCASE', synthetic: true, claimEligible: false, scenarios: dataset.scenarios.length, uniqueIncidents: summary.uniqueIncidents, output: path.relative(root, outputDir) }, null, 2));
