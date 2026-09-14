#!/usr/bin/env bash
set -euo pipefail

TARGET_ROOT="${1:-$HOME/testigent-ai}"
cd "$TARGET_ROOT"

version="$(node -p "require('./package.json').version")"
if [[ "$version" != "1.9.1" ]]; then
  echo "Expected TestigentAI 1.9.1 corrective candidate, found $version" >&2
  exit 2
fi

for required in \
  src/framework/api-contract/schema-validator.ts \
  src/framework/api-contract/breaking-change-detector.ts \
  src/framework/database/database-tls.ts \
  src/framework/database/sql-placeholder.ts \
  src/framework/agentic/policy/path-policy.ts \
  src/framework/mcp/security-policy.ts \
  src/framework/mcp/server.ts \
  src/framework/failure-intelligence/failure-intelligence.types.ts \
  src/framework/failure-intelligence/failure-fingerprint.ts \
  src/framework/failure-intelligence/deterministic-classifier.ts \
  src/framework/failure-intelligence/failure-analyzer.ts \
  src/framework/failure-intelligence/failure-history.store.ts \
  src/framework/reporting/business-dashboard.writer.ts \
  scripts/github-action-pin-check.mjs \
  tests/framework/v1.9.1-review-closure-contract.spec.ts \
  docs/65-v1.9.1-INDEPENDENT-REVIEW-CLOSURE.md; do
  [[ -s "$required" ]] || { echo "Missing v1.9.1 corrective artifact: $required" >&2; exit 3; }
done

node scripts/github-action-pin-check.mjs
node scripts/release-static-check.mjs
node scripts/release-static-portability-contract.mjs
node scripts/offline-release-check.mjs
bash -n APPLY_UPGRADE.sh
bash -n VERIFY_UPGRADE.sh

node - <<'NODE'
const data = require('./showcase/customer-demo.json');
if (data.mode !== 'SHOWCASE' || data.synthetic !== true || data.claimEligible !== false) throw new Error('Showcase trust boundary is not explicit and non-claimable.');
if (!Array.isArray(data.scenarios) || data.scenarios.length < 5 || data.scenarios.length > 10) throw new Error('Showcase must contain 5-10 realistic scenarios.');
if (data.scenarios.some(item => item.evidenceMode !== 'SHOWCASE' || item.synthetic !== true || item.claimEligible !== false)) throw new Error('Every showcase scenario must remain synthetic, SHOWCASE-scoped and non-claimable.');
console.log(`Showcase trust boundary verified for ${data.scenarios.length} scenarios.`);
NODE

echo "Static/offline v1.9.1 candidate verification passed."
echo "Connected Node 22 verification still requires: npm ci && npm run validate:final"
