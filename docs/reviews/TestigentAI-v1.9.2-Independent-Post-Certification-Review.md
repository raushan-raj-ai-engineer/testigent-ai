# TestigentAI v1.9.2 — Independent Post-Certification Review

Date: 14 September 2026  
Archive: `TestigentAI-v1.9.2-POST-CERT-REVIEW.zip`  
SHA-256: `ba711591a5ca4ab47bb380ad192bd6e1af75368a4887ae253f34a70d4f320992`  
ZIP source comment: `c70aa1a3aa41e30b1ca6af5a759e4e4a1ebf6d3d`  
Certified commit reported in the handoff: `f061e4ef1fd869888fdae721d4790ce2058070ae`

## Verdict

**The release is substantially improved, but three code findings remain partially open: R01, R02 and R04.** They concern API schema correctness, breaking-change detection and a dangling-symlink bypass at the selected-project boundary.

The previous report-regeneration regression is fixed in the exercised helper chain. Strict TLS, legacy-classification provenance, the reported SQL cases, and the MCP transport counterexamples also pass targeted checks.

Disposition of the original 14 comments: **10 closed at the targeted code-review level, 3 partially open, and 1 with supplied viewer-qualification evidence that was not independently rerun.** This is a bounded review of the supplied archive, not a claim that all product behavior or external certification was independently verified.

I recommend a focused corrective patch for the three remaining code findings before using those capabilities as authoritative release/security gates. The findings do not require abandoning the shared-core architecture or adding more product features.

## Evidence and limitations

Independently performed:

- Source comparison against the previously reviewed v1.9.1 snapshot.
- Static release gate: PASS, including full-SHA action pin policy, 516-file check and LF/CRLF contracts.
- Offline release check: PASS; 38 JSON, 508 text and 26 required-artifact checks.
- Direct production-module counterexamples for API schemas/diffs, project paths, strict TLS, classification and SQL preparation.
- Same-run evidence materialization/classification/history persistence twice: PASS, stable `trace.zip` reference, no history conflict.
- Real child-process MCP transport probe using the supplied injectable transport and slow-tool harness: oversized unterminated frame rejected, notification-only initialization rejected, saturation rejected, active request cancellation returned correctly.
- Dangling-symlink validation and guarded-path write probe in a disposable directory: cross-project file creation reproduced using harmless sentinel text.

Not independently performed:

- Full package-local typecheck, Playwright regression, browser compatibility matrix, fresh dependency advisory audit or live database certificate integration.
- LibreOffice/Excel qualification: no LibreOffice executable was available here.
- Remote verification of GitHub run IDs, release tags, or the code diff between the archive commit and reported certified commit.

`npm ci --ignore-scripts --offline --no-audit --no-fund` was blocked because `zod@4.5.4` was absent from the cache. This environment has Node 24.19.0; the project supports Node 22.

Direct probes used the original TypeScript with Node's type transform and import resolution. An inert YAML import substitute allowed schema helper loading; YAML parsing was not exercised. Reporting probes evaluated the actual materialization/persistence helpers and imported classifiers/store, rather than rendering the entire UI. The MCP child process used transformed production transport code and the supplied dependency-injected slow tool; the unused default tool-registry import was stubbed because locked dependencies were unavailable. These qualifications prevent confusing targeted evidence with a complete release test.

## Remaining code findings

### R04 — P1: Dangling symlinks pass both proposal and mutation-path validation

**Locations:** `src/framework/agentic/policy/path-policy.ts:142`; `src/framework/intelligence/review/proposal.review.ts:538`.

The new selected-project checks correctly reject existing source-directory symlinks and requirement-root symlinks. However, `assertNoSymlinkComponents` calls `existsSync` before `lstatSync`. For a dangling symlink, `existsSync` returns false, so the loop stops without inspecting the link itself.

Reproduced in a temporary repository:

```text
projects/demo/src/approved.ts -> projects/other/src/not-created.ts
                                (destination does not yet exist)

assertAgenticTargetPath(...)    -> accepted
resolveProjectMutationPath(...) -> accepted
writeFileSync(returnedPath, harmlessText)
                               -> creates projects/other/src/not-created.ts
```

The promotion implementation obtains its target through the same mutation resolver and later calls `writeFile`, which follows symlinks. The probe did not run a complete approved proposal or bypass human approval; it demonstrated that the guarded mutation path itself does not enforce the selected-project boundary.

**Fix:** Inspect directory entries with `lstat` before deciding whether a component is absent. Reject a symlink even if its destination is missing. Treat only a genuine missing entry as a future path. Preserve project/ancestor checks and use an appropriate no-follow/exclusive-create strategy at mutation time; a preflight check alone is not a durable filesystem boundary.

**Acceptance:** Reject dangling leaf and ancestor symlinks, as well as existing symlinks/junctions, through both proposal validation and the actual promotion workflow. A denied operation must create nothing outside the selected project. Include supported Windows behavior.

### R01 — P1: Some supported schema keywords still yield false passes or false failures

**Locations:** `src/framework/api-contract/schema-validator.ts:50,78,91,100`.

The v1.9.1 null/enum, `$ref` sibling and boolean-false-schema counterexamples now fail correctly. Expanded checks still show:

| OpenAPI 3.1 schema | Value | Expected | Actual |
|---|---|---|---|
| `{maxItems:0}` | `[1]` | Reject | No violations |
| `{maxProperties:0}` | `{x:1}` | Reject | No violations |
| `{}` | `null` | Accept | Nullable violation |
| `{anyOf:[{type:'string'},{type:'null'}]}` | `null` | Accept | Nullable violation |

Array/object size checks are gated on the presence of other schema keywords. JSON Schema constraints apply to the applicable instance type even when `type` is omitted. Null handling also imposes an extra local type requirement after composition succeeds; an unconstrained schema should not reject null. These are within the advertised OpenAPI 3.1 semantics. See the official [array reference](https://json-schema.org/understanding-json-schema/reference/array), [object reference](https://json-schema.org/understanding-json-schema/reference/object) and [null reference](https://json-schema.org/understanding-json-schema/reference/null).

**Impact:** Invalid responses can pass a quality gate, while valid nullable responses can be reported as defects.

**Fix:** Apply type-specific constraints according to the runtime JSON value. For 3.1, do not infer a prohibition on null from the absence of an explicit local type; evaluate composition, enum and actual type restrictions together. Preserve separate OpenAPI 3.0 behavior. Prefer a maintained dialect-aware validator or a clearly bounded validator backed by a conformance corpus.

**Acceptance:** Add all four cases through `validateResponseContract`, plus composed size constraints and nullable `$ref` siblings. Test valid and invalid values, not only the original failing examples.

### R02 — P1: Removing property schemas is silently skipped in compatibility comparison

**Location:** `src/framework/api-contract/breaking-change-detector.ts:123`.

Case-sensitive query parameter changes and tightened numeric bounds now produce findings. However, the property loop only compares children that exist in both schemas. Removing a child is skipped.

Request example:

```json
// Previous: {"id":"abc"} is accepted
{"type":"object","additionalProperties":false,
 "properties":{"id":{"type":"string"}}}

// Current: {"id":"abc"} is rejected
{"type":"object","additionalProperties":false}
```

`detectBreakingChanges(previous, current)` returns `[]`.

Response example: changing `{type:'object', properties:{id:{type:'string'}}}` to `{type:'object'}` also returns `[]`. The new response can contain `{id:123}`, which the old schema prohibited. Even though `id` was optional, its type was constrained when present.

**Impact:** Consumers can lose accepted request inputs or response value guarantees while the compatibility gate reports no change.

**Fix:** Compare the effective old and new schema for each property, including the applicable `additionalProperties` policy when a declaration disappears. Apply request narrowing and response widening rules directionally. Return an incomplete verdict where compatibility cannot be established; do not silently skip the change.

**Acceptance:** Test optional and required property removals under `additionalProperties:false`, true/absent, and schema-valued additional properties in both directions. Include nested objects. Retain the newly added bounds, case and recursion cases.

## Closure map

“Closed” below means the reproduced defect is resolved at the reviewed code boundary, with the stated test limits. It does not imply universal conformance or full external qualification.

| ID | Status | Evidence |
|---|---|---|
| R01 | Partial | Prior cases fixed; supported schema constraints/null handling still wrong as above. |
| R02 | Partial | Prior cases fixed; property-removal changes still missed. |
| R03 | Closed — targeted | Strict disabled TLS now throws; invalid modes are rejected; verification policy retained. Live driver/certificate matrix not rerun. |
| R04 | Partial | Existing directory/root links rejected; dangling link accepted at mutation boundary. |
| R05 | Prior closure retained | UNVERIFIED, non-claimable MCP caller policy retained in the reviewed changes. |
| R06 | Prior closure retained | Central classification output redaction retained. |
| R07 | Closed — targeted | `schema editor failed to load` through legacy classifier → adapter → classifier now yields UNKNOWN, insufficient evidence and non-claimable. |
| R08 | Prior closure retained | Cause-aware cluster separation retained. |
| R09 | Closed — targeted | Two materialization/persistence passes preserve the same evidence path and complete without conflict. Persistence moved after main bundle generation. Full browser/merge workflow not rerun. |
| R10 | Closed — targeted | `SELECT ? AS value`, `data ? ?`, native `$1`, and SQL Server bracket-identifier cases now prepare correctly. Live SQL execution not rerun. |
| R11 | Supplied qualification; not independently rerun | Dedicated LibreOffice script and recorded seven-case/no-formula result added. Excel and broader viewer claims remain outside this evidence. |
| R12 | Closed — targeted transport | Child process produced `-32001` for oversize, `-32002` for incomplete initialization, `-32000` for saturation and `-32800` for active cancellation. Full default tool catalog not exercised. |
| R13 | Prior closure retained | Incremental ledger append implementation retained. |
| R14 | Closed — static | Full-SHA action references and enforcing gate pass. |

## Certification documentation — P2 cleanup

The main handoff now records a coherent subsequent-certification outcome:

- Certified commit: `f061e4ef1fd869888fdae721d4790ce2058070ae`.
- Main CI: `34839795426`.
- Main compatibility: `34840215663`, reported 5/5 PASS.
- Tag compatibility: `34840673003`, reported 5/5 PASS.

These are supplied records, not independently queried GitHub results. The review archive's comment identifies a different commit, `c70aa1a3aa41e30b1ca6af5a759e4e4a1ebf6d3d`; I cannot establish a documentation-only difference without the Git diff or equivalent provenance.

`release/VERIFICATION-REPORT.md:51` still says the full ZIP is an uncertified corrective candidate, while the current handoff says certification completed. Preserve historical packaging results, but label that file explicitly as a historical pre-certification record and point it to the final certification outcome. Avoid wording that describes an old snapshot as the current full ZIP.

This documentation inconsistency does not establish that your CI failed. Likewise, green CI does not invalidate the counterexamples reproduced against the archive.

## Product-owner recommendation

Keep the improvements and the current feature freeze. The fixes now address production interactions more effectively, particularly stable report regeneration and real MCP framing/cancellation tests.

The next patch should focus on the remaining filesystem boundary and contract semantics. For the custom schema validator and compatibility analyzer, move from adding one example at a time to a compact conformance suite covering supported keywords, omitted types, composition and request/response direction. Do not market these gates as comprehensive until their supported scope is enforced.

After correcting R01/R02/R04, rerun supported Node 22 typecheck, closure tests, full framework regression, security and compatibility checks on the exact release commit. Qualify real DB/viewer behavior separately and retain clear evidence for those claims. No new dashboard feature or architectural rewrite is needed to close this review.
