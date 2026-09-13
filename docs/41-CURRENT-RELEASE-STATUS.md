# Current Certified Release Status

> **v1.6.0 development candidate:** the working tree adds Quality Evidence Graph, one-click claim verification, explainable score-free release risk, advisory change impact, migration slices and false-heal safety regression. Until connected `validate:final` and the supported compatibility matrix pass for the candidate, **v1.5.3 remains the certified release**.

## Current stable baseline

| Item | Certified state |
|---|---|
| Release | `v1.5.3` |
| Package version | `1.5.3` |
| Main release commit | `14f0a487d3d762fd660d3697f2ed315e709565f3` (`14f0a48`) |
| Runtime | Node.js 22.x |
| Main CI | PASS |
| AI healing lane on trusted `main` | PASS |
| Core sharded execution | PASS |
| Downloaded bundle provenance validation | PASS |
| Business/technical merge | PASS |
| Release Compatibility matrix | PASS 5/5 |

The repository's historical v1.4.x-v1.5.2 documents remain audit evidence. This file is the concise source for the current certified release state.

## Main CI certification

GitHub Actions run:

```text
TestigentAI Multi-Project CI
Run ID: 34744306756
Branch: main
Conclusion: success
```

Certified jobs:

```text
Framework Validation          PASS
Execution Plan                PASS
AI Healing Validation         PASS
Project Tests - Shard 1       PASS
Project Tests - Shard 2       PASS
Merge TestigentAI Reports     PASS
```

The merge job passed:

```text
Restore business report history
Download all technical blobs
Download all business reports
Download AI audit
Validate downloaded report bundles
Merge Playwright technical report
Merge business reports
Finalize business execution facts
Generate TestigentAI business dashboard
Validate final business bundle
Publish merged report summary
Upload final TestigentAI report
Remove intermediate CI artifacts
```

## Release Compatibility certification

Tag-triggered GitHub Actions run:

```text
TestigentAI Release Compatibility
Run ID: 34744507321
Tag: v1.5.3
Conclusion: success
```

Certified matrix:

| Hosted runner | Browser | Result |
|---|---|---|
| Ubuntu | Chromium | PASS |
| Ubuntu | Firefox | PASS |
| Ubuntu | WebKit | PASS |
| macOS | WebKit | PASS |
| Windows | Chromium | PASS |

Each compatibility job passed locked dependency install, supported Node setup, browser installation, static/type validation, architect-review/recovery regression, exact runtime/browser evidence capture and compatibility evidence upload.

## What v1.5.3 closes

v1.5.3 preserves all earlier architect-review controls and adds the final Windows portability correction:

- sensitive-data/evidence redaction and retention controls;
- explicit destination-origin AI egress governance;
- browser-free API/data/DB fixture lane;
- application/environment/run-scoped runtime and reporting;
- healing cache provenance/concurrency controls;
- bounded primary-locator readiness before recovery;
- bounded/schema-validated HTTP AI provider behavior;
- advisory-specific fail-closed security exceptions;
- minimal healing collaborator/logger runtime contract;
- GitHub rerun artifacts scoped by immutable `run_id-run_attempt`;
- downloaded report bundle provenance validation before merge;
- exact current-attempt cleanup behavior;
- Windows CRLF/LF-insensitive release static policy checks.

## Current release workflow

The authoritative path is:

```text
feature branch
 -> npm run validate:final
 -> PR checks
 -> merge to main
 -> main TestigentAI Multi-Project CI
 -> annotated vX.Y.Z tag
 -> automatic TestigentAI Release Compatibility matrix
```

`release-compatibility.yml` remains manually dispatchable for pre-release/diagnostic use, but a pushed `v*` tag automatically triggers the matrix.

## Current CI artifact identity

Every GitHub execution attempt uses:

```text
RUN_ID = github.run_id-github.run_attempt
```

Core, AI, technical, audit and final report artifact names include the immutable run identity. The merge downloads only current-attempt artifacts and validates bundle markers before aggregation.

This prevents attempt 1 and attempt 2 from being silently combined when a workflow is rerun.

## Current AI policy

Local development may use an approved local provider such as Ollama. Trusted CI may use an approved cloud provider such as Gemini. Provider labels do not grant network permission.

Cloud execution requires both:

```text
AI_ALLOW_CLOUD_EGRESS=true
AI_ALLOWED_EXTERNAL_ORIGINS=<exact approved origins>
```

For the certified Gemini CI path, the approved origin is:

```text
https://generativelanguage.googleapis.com
```

Secrets remain in GitHub/Azure secret stores and are never committed.

## Current documentation to start with

For normal project work:

1. `00-START-HERE.md`
2. `02-DAILY-COMMANDS.md`
3. `40-GIT-GITHUB-CLI-TERMINAL-GUIDE.md`
4. `06-REPORTING-CI-CD.md`
5. `12-RELEASE-VALIDATION.md`
6. `33-RELEASE-COMPATIBILITY-MATRIX.md`
7. this file

For release-history details, read `FINAL-RELEASE-NOTES.md` and the version-specific closure documents.
