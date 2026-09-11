#!/usr/bin/env bash
set -euo pipefail
BUNDLE_ROOT="$(cd "$(dirname "$0")" && pwd)"
TARGET_ROOT="${1:-$HOME/testigent-ai}"
MANIFEST="$BUNDLE_ROOT/upgrade/v6-manifest.json"

if [[ ! -f "$MANIFEST" ]]; then echo "Missing upgrade manifest: $MANIFEST" >&2; exit 2; fi
if [[ ! -d "$TARGET_ROOT" ]]; then echo "Target framework directory not found: $TARGET_ROOT" >&2; exit 2; fi

python3 - "$BUNDLE_ROOT" "$TARGET_ROOT" "$MANIFEST" <<'PY'
import hashlib, json, os, shutil, sys, time
from pathlib import Path
bundle, target, manifest = map(Path, sys.argv[1:4])
data=json.loads(manifest.read_text())

def sha(p: Path):
    return hashlib.sha256(p.read_bytes()).hexdigest() if p.exists() and p.is_file() else None

conflicts=[]; plan=[]
for entry in data['entries']:
    rel=entry['path']; op=entry['operation']; baseline=entry.get('baselineSha256'); desired=entry.get('desiredSha256')
    dst=target/rel; current=sha(dst)
    if op=='copy':
        if current==desired: plan.append(('skip',entry)); continue
        if baseline is None:
            if current is not None: conflicts.append(f"{rel}: new V6 file already exists with different content")
            else: plan.append(('copy',entry))
        elif current==baseline: plan.append(('copy',entry))
        else: conflicts.append(f"{rel}: target was modified from the supported baseline")
    elif op=='delete':
        if current is None: plan.append(('skip',entry))
        elif current==baseline: plan.append(('delete',entry))
        else: conflicts.append(f"{rel}: target deletion conflicts with local modification")
    else: conflicts.append(f"{rel}: unsupported operation {op}")

if conflicts:
    print('Upgrade aborted before changing files. Conflicts:', file=sys.stderr)
    for item in conflicts: print(' - '+item, file=sys.stderr)
    sys.exit(3)

backup_root=Path.home()/'testigent-ai-upgrade-backups'/time.strftime('%Y%m%d-%H%M%S')
changed=0; skipped=0
for action, entry in plan:
    rel=entry['path']; dst=target/rel; src=bundle/rel
    if action=='skip': skipped+=1; continue
    if dst.exists():
        b=backup_root/rel; b.parent.mkdir(parents=True,exist_ok=True); shutil.copy2(dst,b)
    if action=='copy':
        dst.parent.mkdir(parents=True,exist_ok=True); shutil.copy2(src,dst); changed+=1
    else:
        dst.unlink(); changed+=1

# Generated release/upgrade metadata cannot hash itself into the manifest without a cycle.
# Sync those bundle-owned files after the conflict-safe content plan, then VERIFY_UPGRADE compares them byte-for-byte.
metadata_synced=0
for rel in ['upgrade/v6-manifest.json', 'release/RELEASE-MANIFEST.sha256']:
    src=bundle/rel; dst=target/rel
    if not src.exists():
        continue
    if sha(dst)==sha(src):
        continue
    if dst.exists():
        b=backup_root/rel; b.parent.mkdir(parents=True,exist_ok=True); shutil.copy2(dst,b)
    dst.parent.mkdir(parents=True,exist_ok=True); shutil.copy2(src,dst); metadata_synced+=1

print(json.dumps({'ok':True,'changed':changed,'skipped':skipped,'metadataSynced':metadata_synced,'backup':str(backup_root) if backup_root.exists() else None},indent=2))
PY
"$BUNDLE_ROOT/VERIFY_UPGRADE.sh" "$TARGET_ROOT"
