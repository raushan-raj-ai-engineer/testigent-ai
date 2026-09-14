import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  hasInformationalBusinessSummaryContract,
  hasReviewMetadataContract,
  normalizeContractText
} from './lib/release-text-contracts.mjs';

const root = process.cwd();
const workflowPath = path.join(root, '.github', 'workflows', 'playwright-sharded.yml');
const workflow = fs.readFileSync(workflowPath, 'utf8');
const crlfWorkflow = normalizeContractText(workflow).replace(/\n/g, '\r\n');

const metadataPath = path.join(root, 'REVIEW-METADATA.txt');
const metadata = fs.readFileSync(metadataPath, 'utf8');
const crlfMetadata = normalizeContractText(metadata).replace(/\n/g, '\r\n');

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

assert.equal(
  hasReviewMetadataContract(metadata),
  true,
  'LF review metadata must identify the v1.9.2 candidate and certified baseline'
);

assert.equal(
  hasReviewMetadataContract(crlfMetadata),
  true,
  'CRLF review metadata must identify the v1.9.2 candidate and certified baseline'
);

console.log(JSON.stringify({
  ok: true,
  contracts: [
    'merged-report-summary',
    'v1.9.2-review-metadata'
  ],
  variants: ['LF', 'CRLF']
}, null, 2));
