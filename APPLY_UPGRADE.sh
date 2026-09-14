#!/usr/bin/env bash
set -euo pipefail

BUNDLE_ROOT="$(cd "$(dirname "$0")" && pwd)"
TARGET_ROOT="${1:-$HOME/testigent-ai}"
CERTIFIED_V191_SHA="38e2406c73608cabcf42a8ff0ea8e35e745dea23"
POST_RELEASE_V191_MAIN_SHA="bcfa7d8905b51ba66673478e43eab3c5ea4f9fdc"

if [[ ! -d "$TARGET_ROOT/.git" ]]; then
  echo "Target must be an existing TestigentAI Git worktree: $TARGET_ROOT" >&2
  exit 2
fi

branch="$(git -C "$TARGET_ROOT" branch --show-current)"
if [[ -z "$branch" || "$branch" == "main" || "$branch" == "master" ]]; then
  echo "Refusing to apply v1.9.2 re-review corrective candidate on '$branch'. Create a feature branch from current main first." >&2
  exit 3
fi

if [[ "${TESTIGENT_ALLOW_DIRTY_UPGRADE:-false}" != "true" ]] && [[ -n "$(git -C "$TARGET_ROOT" status --porcelain)" ]]; then
  echo "Target worktree is dirty. Commit/stash first, or set TESTIGENT_ALLOW_DIRTY_UPGRADE=true deliberately." >&2
  exit 4
fi

bundle_version="$(node -p "require('$BUNDLE_ROOT/package.json').version")"
if [[ "$bundle_version" != "1.9.2" ]]; then
  echo "Unexpected bundle version: $bundle_version" >&2
  exit 5
fi

target_version="$(node -p "require('$TARGET_ROOT/package.json').version" 2>/dev/null || true)"
if [[ "$target_version" != "1.9.1" && "$target_version" != "1.9.2" ]]; then
  echo "Expected target version 1.9.1 (or 1.9.2 for deliberate re-application), found '${target_version:-unknown}'." >&2
  exit 6
fi

if ! git -C "$TARGET_ROOT" rev-parse -q --verify refs/tags/v1.9.1 >/dev/null; then
  echo "Missing required certified v1.9.1 tag in target repository." >&2
  exit 7
fi

actual_v191_sha="$(git -C "$TARGET_ROOT" rev-list -n 1 v1.9.1)"
if [[ "$actual_v191_sha" != "$CERTIFIED_V191_SHA" ]]; then
  echo "Refusing upgrade: v1.9.1 tag resolves to $actual_v191_sha, expected immutable certified SHA $CERTIFIED_V191_SHA." >&2
  exit 8
fi

if ! git -C "$TARGET_ROOT" cat-file -e "$POST_RELEASE_V191_MAIN_SHA^{commit}" 2>/dev/null; then
  echo "Target repository does not contain the v1.9.1 post-release documentation baseline $POST_RELEASE_V191_MAIN_SHA." >&2
  exit 9
fi

if ! git -C "$TARGET_ROOT" merge-base --is-ancestor "$POST_RELEASE_V191_MAIN_SHA" HEAD; then
  echo "Refusing upgrade: feature branch must descend from current v1.9.1 post-release main $POST_RELEASE_V191_MAIN_SHA." >&2
  exit 10
fi

python3 - "$BUNDLE_ROOT" "$TARGET_ROOT" <<'PY'
import hashlib
import json
import shutil
import sys
import time
from pathlib import Path

bundle, target = map(Path, sys.argv[1:3])
excluded_roots = {
    '.git', 'node_modules', 'reports', 'test-results', 'playwright-report', 'blob-report',
    '.runtime', '.auth', '.healing', '.report-history', 'coverage', 'dist', 'upgrade'
}
excluded_files = {'.env', '.DS_Store'}
# Historical certified artifacts remain immutable. v1.9.2 changes only the re-review corrective scope.
protected = {
    'docs/49-v1.6.1-DEEP-REVIEW-VALIDATION.md',
    'docs/50-v1.7.0-AGENTIC-TEST-INTELLIGENCE.md',
    'docs/53-v1.7.0-DEEP-REVIEW-VALIDATION.md',
    'docs/54-v1.7.0-CANDIDATE-HANDOFF.md',
    'docs/62-v1.9.0-REVIEW-AND-RELEASE-PLAN.md',
    'docs/63-REPORTING-FREEZE.md',
    'docs/64-v1.9.0-CANDIDATE-HANDOFF.md',
    'scripts/security-check.ts',
    'src/framework/security/npm-bulk-audit.ts',
    'tests/framework/review-hardening-contract.spec.ts',
    'showcase/customer-demo.json',
    'src/framework/benchmark/benchmark-analyzer.ts',
    'tests/helpers/agent-ledger-writer.ts',
    'tests/framework/dashboard-interactive.spec.ts',
}

def digest(path: Path) -> str | None:
    if not path.is_file():
        return None
    return hashlib.sha256(path.read_bytes()).hexdigest()

before = {rel: digest(target / rel) for rel in sorted(protected)}
missing = [rel for rel, value in before.items() if value is None]
if missing:
    raise SystemExit('Protected historical target files are missing: ' + ', '.join(missing))

backup = Path.home() / 'testigent-ai-upgrade-backups' / f"v1.9.2-{time.strftime('%Y%m%d-%H%M%S')}"
changed = skipped = protected_skipped = 0
for src in sorted(p for p in bundle.rglob('*') if p.is_file()):
    rel_path = src.relative_to(bundle)
    rel = rel_path.as_posix()
    if rel_path.parts and rel_path.parts[0] in excluded_roots:
        continue
    if src.name in excluded_files or src.suffix == '.zip' or src.name.endswith('.zip.sha256'):
        continue
    if rel in protected:
        protected_skipped += 1
        continue
    dst = target / rel_path
    if dst.exists() and dst.is_file() and dst.read_bytes() == src.read_bytes():
        skipped += 1
        continue
    if dst.exists() and dst.is_file():
        b = backup / rel_path
        b.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(dst, b)
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    changed += 1

after = {rel: digest(target / rel) for rel in sorted(protected)}
modified = [rel for rel in protected if before[rel] != after[rel]]
if modified:
    raise SystemExit('Protected historical files changed during upgrade: ' + ', '.join(sorted(modified)))

print(json.dumps({
    'ok': True,
    'bundleVersion': '1.9.2',
    'changed': changed,
    'skipped': skipped,
    'protectedSkipped': protected_skipped,
    'protectedFilesVerifiedUnchanged': len(protected),
    'backup': str(backup) if backup.exists() else None,
}, indent=2))
PY

"$BUNDLE_ROOT/VERIFY_UPGRADE.sh" "$TARGET_ROOT"

echo "v1.9.2 re-review corrective candidate applied to branch '$branch'."
echo "The immutable v1.9.1 and v1.9.0 tags remain untouched."
echo "Review with: git -C '$TARGET_ROOT' status -sb && git -C '$TARGET_ROOT' diff --check"
