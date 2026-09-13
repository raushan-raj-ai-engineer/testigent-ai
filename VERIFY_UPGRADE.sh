#!/usr/bin/env bash
set -euo pipefail
TARGET_ROOT="${1:-$HOME/testigent-ai}"
cd "$TARGET_ROOT"

version="$(node -p "require('./package.json').version")"
if [[ "$version" != "1.7.0" ]]; then
  echo "Expected TestigentAI 1.7.0 candidate, found $version" >&2
  exit 2
fi

for required in \
  src/framework/agentic/policy/agentic-policy.ts \
  src/framework/agentic/evidence/agent-decision-ledger.ts \
  src/framework/mcp/server.ts \
  tests/framework/agentic-policy-contract.spec.ts \
  docs/50-v1.7.0-AGENTIC-TEST-INTELLIGENCE.md \
  docs/53-v1.7.0-DEEP-REVIEW-VALIDATION.md; do
  [[ -s "$required" ]] || { echo "Missing v1.7.0 candidate artifact: $required" >&2; exit 3; }
done

node scripts/release-static-check.mjs
node scripts/offline-release-check.mjs
bash -n APPLY_UPGRADE.sh
bash -n VERIFY_UPGRADE.sh

echo "TestigentAI v1.7.0 candidate upgrade verification passed."
