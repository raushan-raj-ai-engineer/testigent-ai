#!/usr/bin/env bash
set -euo pipefail

TARGET_ROOT="${1:-$HOME/testigent-ai}"
cd "$TARGET_ROOT"

version="$(node -p "require('./package.json').version")"
if [[ "$version" != "1.9.0" ]]; then
  echo "Expected TestigentAI 1.9.0 candidate, found $version" >&2
  exit 2
fi

for required in \
  src/framework/failure-intelligence/failure-intelligence.types.ts \
  src/framework/failure-intelligence/failure-normalizer.ts \
  src/framework/failure-intelligence/failure-fingerprint.ts \
  src/framework/failure-intelligence/deterministic-classifier.ts \
  src/framework/failure-intelligence/failure-analyzer.ts \
  src/framework/failure-intelligence/failure-history.store.ts \
  src/framework/failure-intelligence/report-adapter.ts \
  src/framework/failure-intelligence/showcase-policy.ts \
  src/framework/reporting/failure-intelligence.renderer.ts \
  src/framework/reporting/customer-showcase.renderer.ts \
  src/framework/security/npm-bulk-audit.ts \
  scripts/showcase.ts \
  showcase/customer-demo.json \
  tests/framework/failure-intelligence-contract.spec.ts \
  tests/framework/showcase-isolation-contract.spec.ts \
  tests/framework/reporting-freeze-contract.spec.ts \
  tests/framework/security-bulk-audit-contract.spec.ts \
  docs/60-v1.9.0-FAILURE-INTELLIGENCE.md \
  docs/61-v1.9.0-CUSTOMER-SHOWCASE.md \
  docs/62-v1.9.0-REVIEW-AND-RELEASE-PLAN.md \
  docs/63-REPORTING-FREEZE.md \
  docs/64-v1.9.0-CANDIDATE-HANDOFF.md; do
  [[ -s "$required" ]] || { echo "Missing v1.9.0 candidate artifact: $required" >&2; exit 3; }
done

node scripts/release-static-check.mjs
node scripts/offline-release-check.mjs
bash -n APPLY_UPGRADE.sh
bash -n VERIFY_UPGRADE.sh

node - <<'NODE'
const data = require('./showcase/customer-demo.json');
if (data.mode !== 'SHOWCASE' || data.synthetic !== true || data.claimEligible !== false) {
  throw new Error('Showcase trust boundary is not explicit and non-claimable.');
}
if (!Array.isArray(data.scenarios) || data.scenarios.length < 5 || data.scenarios.length > 10) {
  throw new Error('Showcase must contain 5-10 realistic scenarios.');
}
if (data.scenarios.some((item) => item.evidenceMode !== 'SHOWCASE' || item.synthetic !== true || item.claimEligible !== false)) {
  throw new Error('Every showcase scenario must remain synthetic, SHOWCASE-scoped and non-claimable.');
}
console.log(`Showcase trust boundary verified for ${data.scenarios.length} scenarios.`);
NODE

echo "TestigentAI v1.9.0 candidate upgrade verification passed."
