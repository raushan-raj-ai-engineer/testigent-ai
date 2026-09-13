# Release Compatibility Matrix

TestigentAI **v1.6.0** treats **Node.js 22.x** (pinned by `.nvmrc`) as the supported release runtime. Do not infer support for a Node version merely because a source-only check happens to run on it.

## Trigger policy

`TestigentAI Release Compatibility` supports both:

- automatic execution on pushed `v*` release tags; and
- manual `workflow_dispatch` for pre-release/diagnostic evidence.

Normal `main` pushes use `TestigentAI Multi-Project CI`; the broader OS/browser compatibility matrix is intentionally release-oriented rather than running on every commit.

## Certified v1.6.0 matrix

The tag-triggered v1.6.0 run `34760349497` completed successfully across all supported matrix entries:

| OS / hosted runner | Browser | v1.6.0 result |
| --- | --- | --- |
| Ubuntu | Chromium | PASS |
| Ubuntu | Firefox | PASS |
| Ubuntu | WebKit | PASS |
| macOS | WebKit | PASS |
| Windows | Chromium | PASS |

The Windows/Chromium entry remains an important cross-platform acceptance point: it proves `release:static` is line-ending portable under Windows CRLF checkout behavior before the browser-backed recovery regression executes.

## What every matrix job proves

Every matrix job uses:

1. locked dependency installation with `npm ci`;
2. Node.js 22.x from `.nvmrc`;
3. the browser version installed by the locked Playwright package;
4. `release:static` and `typecheck`;
5. the architect-review/recovery regression slice, including browser-free fixture and delayed-primary recovery coverage;
6. exact Node/Playwright/OS/browser evidence capture; and
7. compatibility evidence upload.

This is release evidence, not a claim about untested OS/browser combinations. Azure Pipelines remains the second real CI implementation for the supported Linux/Node 22 path.

## Terminal operations

List compatibility runs:

```bash
gh run list --workflow release-compatibility.yml --limit 5
```

Watch a run:

```bash
gh run watch <RUN_ID>
```

Inspect failures:

```bash
gh run view <RUN_ID> --log-failed
```

See `40-GIT-GITHUB-CLI-TERMINAL-GUIDE.md` for GitHub CLI installation/authentication and the complete release workflow.
