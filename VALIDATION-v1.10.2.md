# TestigentAI TypeScript v1.10.2 Validation

## Release objective

Unify normal and complex test creation behind one user-facing command:

`npm run qa -- create <source> [--auto-explore | --learn="Journey"]`

Complex UI handling remains automatic inside the recorder/generator. There is no separate user-facing complex mode or dedicated complex release-test command.

## Validation results

| Check | Result |
|---|---|
| Package/package-lock version consistency | PASS (1.10.2) |
| Unified authoring command contract | PASS |
| Compatibility aliases route to unified workflow | PASS |
| Separate `test:complex-exploration` command removed | PASS |
| Complex contract included in normal `test:framework:critical` suite | PASS |
| TypeScript syntax/transpile scan | PASS — 349 files, 0 syntax errors |
| GitHub Actions pin policy | PASS |
| Release static check | PASS |
| Release portability contract | PASS |
| Architecture audit | PASS — 0 issues |
| Reusable export documentation audit | PASS — 0 issues |
| Credential-like literal scan on changed authoring/docs files | PASS |
| Documentation updated for one-command workflow | PASS |

Repository package size before release cleanup: 530 files excluding partial node_modules; 349 TypeScript/TSX files.

## Dependency-backed test limitation

A fresh `npm ci --ignore-scripts --prefer-offline` was attempted in the build environment but the container transport timed out before dependencies were available. Therefore this build does **not** claim a fresh full dependency-backed `npm run typecheck` or live Playwright browser execution in this sandbox.

The permanent regression contract remains at:

`tests/framework/unified-exploration-generation-contract.spec.ts`

and is covered by the normal full framework regression command:

`npm run test:framework:critical`

On a normal development machine, final customer qualification remains:

`npm ci`
`npx playwright install chromium`
`npm run validate:final`

No failed check above was hidden or reclassified as passing.
