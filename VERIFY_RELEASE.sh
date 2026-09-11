#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

echo "[1/4] Dependency-independent release checks"
node scripts/release-static-check.mjs
node scripts/offline-release-check.mjs
bash -n VERIFY_RELEASE.sh

if [[ "${1:-}" == "--offline" ]]; then
  echo "Offline release verification passed. Dependency-backed checks were intentionally skipped."
  exit 0
fi

echo "[2/4] Clean reproducible dependency install"
npm ci

echo "[3/4] Full TestigentAI validation"
npm run validate:final
npm run test:ai-evaluation

echo "[4/4] Supply-chain inventory"
node scripts/generate-sbom.mjs
node scripts/offline-release-check.mjs

echo "TestigentAI full release verification passed."
