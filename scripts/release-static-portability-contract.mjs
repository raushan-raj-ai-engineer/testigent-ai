import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  hasInformationalBusinessSummaryContract,
  normalizeContractText
} from './lib/release-text-contracts.mjs';

const root = process.cwd();
const workflowPath = path.join(root, '.github', 'workflows', 'playwright-sharded.yml');
const workflow = fs.readFileSync(workflowPath, 'utf8');
const crlfWorkflow = normalizeContractText(workflow).replace(/\n/g, '\r\n');

assert.equal(
  hasInformationalBusinessSummaryContract(workflow),
  true,
  'LF workflow must preserve the informational merged-report summary contract'
);
assert.equal(
  hasInformationalBusinessSummaryContract(crlfWorkflow),
  true,
  'CRLF workflow must preserve the informational merged-report summary contract'
);
assert.equal(
  normalizeContractText(crlfWorkflow),
  normalizeContractText(workflow),
  'contract normalization must produce identical text for LF and CRLF inputs'
);

console.log(JSON.stringify({
  ok: true,
  contract: 'merged-report-summary',
  variants: ['LF', 'CRLF']
}, null, 2));
