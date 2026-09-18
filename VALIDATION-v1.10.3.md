# TestigentAI TypeScript v1.10.3 Validation Report

## Scope

Hotfix for unified `qa create` requirement-source handling discovered during a real demo run.

### Fixed

- validates/loads Markdown/Jira/etc. requirement **before** auto/manual browser exploration;
- missing local `.md/.json/.csv/.xlsx` paths now fail immediately with an explicit file-not-found message and resolved path;
- avoids wasting a manual journey before discovering a bad source path;
- adds TodoMVC-aligned `projects/demo/requirements/todo-create.md` for real exploration smoke testing;
- keeps the existing `payment.md` as a synthetic multi-layer architecture example;
- adds permanent requirement-source regression coverage.

## Executed checks

| Check | Result |
|---|---|
| Package version | PASS (`1.10.3`) |
| Existing relative Markdown load | PASS |
| Missing Markdown precise error | PASS |
| Validation occurs before exploration | PASS |
| All TypeScript files syntax/transpile scan | PASS (350 files, 0 syntax errors) |
| Release static check | PASS |
| GitHub Actions pin policy | PASS |
| Release portability contract | PASS |
| Architecture audit | PASS (0 issues) |
| Reusable export documentation audit | PASS (288 declarations, 0 issues) |
| ZIP integrity | Performed during packaging |

## Environment-limited checks

A fresh `npm ci` was attempted in the build sandbox but registry/network transport timed out, leaving an incomplete install which was removed before packaging. Therefore this report does **not** claim a fresh dependency-backed full `npm run validate:final` run in this sandbox.

The security gate is fail-closed and requires usable npm advisory evidence. Both `npm audit` and the Bulk Advisory fallback were unavailable because the sandbox could not resolve/reach the npm registry, so a fresh dependency vulnerability verdict is intentionally **not** claimed here.

On a normal connected developer machine run:

```bash
npm ci
npx playwright install chromium
npm run validate:final
```

## Regression test added

```text
tests/framework/requirement-source-validation.contract.spec.ts
```

It protects:

1. valid Markdown requirement loading;
2. precise missing-file diagnostics; and
3. fail-fast validation-before-exploration ordering.
