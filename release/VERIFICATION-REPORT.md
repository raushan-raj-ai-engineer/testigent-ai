# TestigentAI v1.2.0 Verification Report

## Release scope

This release adds the schema-driven declarative UI authoring layer while preserving the code-first Playwright architecture. Declarative YAML remains optional per project.

## Dependency-independent verification completed in the release workspace

- Release static check: PASS — 301 files before the final verification report/manifest refresh.
- Offline release/security/reproducibility check: PASS — 24 JSON files, 293 text files, 18 required artifacts.
- TypeScript/TSX parser check: PASS — 203 files, 0 syntax errors.
- Architecture check: PASS — demo and sdet-practice, 0 issues.
- Reusable export comment audit: PASS — 154 declarations, 0 issues.
- Declarative pure contracts: PASS — application-root navigation, same-origin absolute navigation, cross-origin denial, Draft 2020-12 schema, schema/action alignment, semantic locator catalog.
- Shell syntax: PASS.
- DOCX structural integrity: PASS for both shipped documents.
- Declarative authoring DOCX challenge-log visual QA: 18/18 rendered pages reviewed clean during release preparation.
- CycloneDX SBOM: generated for v1.2.0 with 149 locked components.

## Full dependency-backed verification status

A fresh `npm ci` could not be completed in the packaging sandbox because package-registry access is unavailable/intermittent in this environment. Therefore this report does not claim that the v1.2.0 dependency-backed TypeScript/Playwright suite passed here.

Run the following on a normal networked development/CI machine after extracting the ZIP:

```bash
./VERIFY_RELEASE.sh
```

That command performs a clean `npm ci`, `validate:final`, framework critical tests, AI-evaluation contract tests, SBOM generation, and the offline release checks.

## Upgrade verification

The final package includes a conflict-safe, idempotent upgrade manifest targeting the reconstructed v1.1.2 stable baseline (including the PR CI hardening and TodoMVC declarative-route hotfix that were merged after the v1.1.2 ZIP). The release process re-applies the upgrade twice to prove idempotency before packaging.
