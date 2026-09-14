#!/usr/bin/env bash
set -euo pipefail
BUNDLE_ROOT="$(cd "$(dirname "$0")" && pwd)"
TARGET_ROOT="${1:-$HOME/testigent-ai}"

if [[ ! -d "$TARGET_ROOT/.git" ]]; then
  echo "Target must be an existing TestigentAI Git worktree: $TARGET_ROOT" >&2
  exit 2
fi

branch="$(git -C "$TARGET_ROOT" branch --show-current)"
if [[ -z "$branch" || "$branch" == "main" || "$branch" == "master" ]]; then
  echo "Refusing to apply v1.8.0 candidate on '$branch'. Use a feature branch." >&2
  exit 3
fi

if [[ "${TESTIGENT_ALLOW_DIRTY_UPGRADE:-false}" != "true" ]] && [[ -n "$(git -C "$TARGET_ROOT" status --porcelain)" ]]; then
  echo "Target worktree is dirty. Commit/stash first, or set TESTIGENT_ALLOW_DIRTY_UPGRADE=true deliberately." >&2
  exit 4
fi

bundle_version="$(node -p "require('$BUNDLE_ROOT/package.json').version")"
if [[ "$bundle_version" != "1.8.0" ]]; then
  echo "Unexpected bundle version: $bundle_version" >&2
  exit 5
fi

target_version="$(node -p "require('$TARGET_ROOT/package.json').version" 2>/dev/null || true)"
if [[ "$target_version" != "1.7.0" && "$target_version" != "1.8.0" ]]; then
  echo "Expected target version 1.7.0 or 1.8.0, found '${target_version:-unknown}'." >&2
  exit 6
fi

python3 - "$BUNDLE_ROOT" "$TARGET_ROOT" <<'PY'
import json, shutil, sys, time
from pathlib import Path
bundle, target = map(Path, sys.argv[1:3])
excluded_roots={'.git','node_modules','reports','test-results','playwright-report','blob-report','.runtime','.auth','.healing','.report-history','coverage','dist','upgrade'}
excluded_files={'.env','.DS_Store'}
backup=Path.home()/'testigent-ai-upgrade-backups'/f"v1.8.0-{time.strftime('%Y%m%d-%H%M%S')}"
changed=skipped=0
for src in sorted(p for p in bundle.rglob('*') if p.is_file()):
    rel=src.relative_to(bundle)
    if rel.parts and rel.parts[0] in excluded_roots: continue
    if src.name in excluded_files or src.suffix in {'.zip'}: continue
    dst=target/rel
    if dst.exists() and dst.is_file() and dst.read_bytes()==src.read_bytes():
        skipped += 1; continue
    if dst.exists() and dst.is_file():
        b=backup/rel; b.parent.mkdir(parents=True,exist_ok=True); shutil.copy2(dst,b)
    dst.parent.mkdir(parents=True,exist_ok=True); shutil.copy2(src,dst); changed += 1
print(json.dumps({'ok':True,'bundleVersion':'1.8.0','changed':changed,'skipped':skipped,'backup':str(backup) if backup.exists() else None},indent=2))
PY

"$BUNDLE_ROOT/VERIFY_UPGRADE.sh" "$TARGET_ROOT"

echo "Candidate applied to branch '$branch'. Review with: git -C '$TARGET_ROOT' status -sb && git -C '$TARGET_ROOT' diff --check"
