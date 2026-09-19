# Current Release Status — TestigentAI v1.10.3

## Status

**Current release: `v1.10.3`**

Status at this documentation package:

- release tag `v1.10.3` exists and remains immutable;
- release compatibility workflow passed for the release tag;
- current `main` includes the post-release unified-authoring contract alignment;
- full TestigentAI Multi-Project CI run `35394892371` completed successfully;
- deterministic framework/product safety lanes passed;
- sharded project execution passed;
- merged report generation passed;
- AI live provider canary remained non-blocking by design.

## Main CI evidence

```text
Run: 35394892371
Workflow: TestigentAI Multi-Project CI
Branch: main
Result: SUCCESS

✓ Execution Plan
✓ Framework Validation
✓ Project Tests - Shard 1
✓ Agentic Deterministic Safety
✓ Product Intelligence Deterministic Safety
✓ Failure Intelligence Deterministic Safety
✓ AI Deterministic Safety
✓ AI Live Provider Canary (non-blocking)
✓ Project Tests - Shard 2
✓ Merge TestigentAI Reports
```

## v1.10.3 release focus

v1.10.3 closes the final certification gaps around the unified authoring workflow and its supporting quality contracts.

Key areas include:

1. fail-fast requirement-source validation before browser exploration;
2. browser capture reliability improvements for real interaction evidence;
3. latest-approved journey preference when no explicit journey is supplied;
4. stronger proposal validation for unresolved placeholders, invalid/missing data, secrets and TypeScript syntax;
5. promotion-target consistency and non-destructive human-owned test protection;
6. runtime `.testigent` state isolation from release-static scanning;
7. public/external endpoint isolation from deterministic product certification;
8. `domcontentloaded` navigation behavior for stable generated/shared navigation;
9. a passing full main CI pipeline after the unified-authoring release contract alignment.

## External integration policy

Public demo endpoints such as TodoMVC and JSONPlaceholder are useful integration evidence but can be unavailable or slow independently of TestigentAI.

Therefore:

- deterministic framework/release certification does not depend on them;
- external checks remain executable through `npm run test:external`;
- strict public performance enforcement is opt-in;
- transient third-party failures cannot incorrectly classify the framework as unhealthy.

## Version/documentation policy

The main README should show only the current release prominently.

Historical release evidence belongs in release-specific documents and release notes so the public landing page does not become a chronological audit log.

Important current references:

- `docs/73-v1.10.2-UNIFIED-TEST-CREATION.md` — unified authoring design line
- `docs/75-v1.10.3-SOURCE-VALIDATION-HOTFIX.md` — v1.10.3 source-validation closure
- `docs/76-v1.10.3-FINAL-CERTIFICATION.md` — v1.10.3 final certification

The v1.10.3 tag should not be moved merely to include later documentation or compatibility-only adjustments.

## Historical certification evidence

The following immutable v1.9.3 certification evidence is retained for release-governance traceability:

- Current certified release: v1.9.3
- v1.9.3 release commit: `b9e3fc1e09fbb39850cc8cc068758ed07d52f942`
- v1.9.3 release compatibility workflow: `34866842175`
- Previous certified release: v1.9.2
- v1.9.2 release commit: `f061e4ef1fd869888fdae721d4790ce2058070ae`

