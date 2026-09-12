# Release Compatibility Matrix

TestigentAI v1.5.0 treats **Node 22 (the version pinned by `.nvmrc`)** as the supported release runtime. Do not infer support for a Node version merely because a source-only check happens to run on it.

Before a release candidate is promoted, run the manual GitHub workflow **TestigentAI Release Compatibility**. It executes the security/recovery regression slice across:

| OS | Browser |
| --- | --- |
| Ubuntu hosted runner | Chromium |
| Ubuntu hosted runner | Firefox |
| Ubuntu hosted runner | WebKit |
| macOS hosted runner | WebKit |
| Windows hosted runner | Chromium |

Every matrix job uses `npm ci`, the locked Playwright version, the browser installed by that Playwright release, `release:static`, `typecheck`, the architect-review hardening suite, the browser-free fixture contract and the delayed-primary recovery contract. It then writes a machine-readable compatibility record containing the exact Node, Playwright, OS and browser versions and uploads the report/test artifacts.

This workflow is evidence generation, not a claim that every combination has passed until a real workflow run is attached to the release. Azure Pipelines remains the second real CI implementation for the supported Linux/Node 22 path.
