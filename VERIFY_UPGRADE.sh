#!/usr/bin/env bash
set -euo pipefail
BUNDLE_ROOT="$(cd "$(dirname "$0")" && pwd)"
TARGET_ROOT="${1:-$HOME/testigent-ai}"
MANIFEST="$BUNDLE_ROOT/upgrade/v6-manifest.json"
python3 - "$BUNDLE_ROOT" "$TARGET_ROOT" "$MANIFEST" <<'PY'
import hashlib,json,sys
from pathlib import Path
bundle,target,manifest=map(Path,sys.argv[1:4]); data=json.loads(manifest.read_text()); problems=[]; checked=0
sha=lambda p: hashlib.sha256(p.read_bytes()).hexdigest() if p.exists() and p.is_file() else None
for e in data['entries']:
    checked+=1; cur=sha(target/e['path'])
    if e['operation']=='copy' and cur!=e.get('desiredSha256'): problems.append(f"{e['path']}: desired hash mismatch")
    if e['operation']=='delete' and cur is not None: problems.append(f"{e['path']}: should be absent")
for rel in ['upgrade/v6-manifest.json', 'release/RELEASE-MANIFEST.sha256']:
    src=bundle/rel
    if src.exists():
        checked+=1
        if sha(target/rel)!=sha(src): problems.append(f"{rel}: bundle metadata mismatch")
if problems:
    print(json.dumps({'ok':False,'checked':checked,'problems':problems},indent=2)); sys.exit(1)
print(json.dumps({'ok':True,'checked':checked},indent=2))
PY
