#!/usr/bin/env bash
set -euo pipefail
TARGET_ROOT="${1:-$HOME/testigent-ai}"
cd "$TARGET_ROOT"

version="$(node -p "require('./package.json').version")"
if [[ "$version" != "1.8.0" ]]; then
  echo "Expected TestigentAI 1.8.0 candidate, found $version" >&2
  exit 2
fi

for required in \
  src/framework/agentic/evidence/agent-decision-ledger.ts \
  src/framework/adoption/adoption-store.ts \
  src/framework/adoption/adoption-analyzer.ts \
  src/framework/benchmark/benchmark-provenance.ts \
  src/framework/benchmark/comparative-benchmark.ts \
  src/framework/benchmark/scale-certification.ts \
  src/framework/api-contract/openapi-loader.ts \
  src/framework/api-contract/response-contract-validator.ts \
  src/framework/api-contract/breaking-change-detector.ts \
  scripts/adoption-pilot.ts \
  scripts/benchmark-compare.ts \
  scripts/benchmark-false-heal.ts \
  scripts/benchmark-scale.ts \
  scripts/api-contract.ts \
  tests/framework/adoption-intelligence-contract.spec.ts \
  tests/framework/benchmark-intelligence-contract.spec.ts \
  tests/framework/api-contract-intelligence-contract.spec.ts \
  tests/framework/product-intelligence-reporting-contract.spec.ts \
  schemas/testigent-benchmark-samples.schema.json \
  schemas/testigent-false-heal-evidence.schema.json \
  schemas/testigent-scale-evidence.schema.json \
  docs/55-v1.8.0-ADOPTION-BENCHMARK-INTELLIGENCE.md \
  docs/56-v1.8.0-API-CONTRACT-INTELLIGENCE.md \
  docs/57-v1.8.0-SCALE-CERTIFICATION.md \
  docs/58-v1.8.0-IMPLEMENTATION-AND-REVIEW-PLAN.md \
  docs/59-v1.8.0-CANDIDATE-HANDOFF.md; do
  [[ -s "$required" ]] || { echo "Missing v1.8.0 candidate artifact: $required" >&2; exit 3; }
done

node scripts/release-static-check.mjs
node scripts/offline-release-check.mjs
bash -n APPLY_UPGRADE.sh
bash -n VERIFY_UPGRADE.sh

echo "TestigentAI v1.8.0 candidate upgrade verification passed."
