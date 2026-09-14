#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

echo "[1/5] Dependency-independent release checks"
node scripts/github-action-pin-check.mjs
node scripts/release-static-check.mjs
node scripts/release-static-portability-contract.mjs
node scripts/offline-release-check.mjs
bash -n APPLY_UPGRADE.sh
bash -n VERIFY_UPGRADE.sh
bash -n VERIFY_RELEASE.sh

if [[ "${1:-}" == "--offline" ]]; then
  echo "Offline release verification passed. Dependency-backed checks were intentionally not claimed."
  exit 0
fi

echo "[2/5] Clean reproducible dependency install"
npm ci

echo "[3/5] Full TestigentAI and re-review validation"
npm run validate:final
npm run release:csv-viewer
npm run showcase:validate
npm run test:ai-evaluation

echo "[4/5] Supply-chain inventory"
npm run release:sbom
npm run release:manifest

echo "[5/5] Final static/offline verification"
npm run release:static
npm run release:offline

echo "TestigentAI v1.9.2 full release verification passed."
