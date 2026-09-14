# TestigentAI v1.9.1 — Independent Re-review

Date: 14 September 2026  
Input: `TestigentAI-v1.9.1-CERTIFIED-REVIEW.zip`  
SHA-256: `5488d96db20a841aaa4eae6f4a5754498c0260886464965ed9268d40bc53bbcf`  
ZIP comment: `38e2406c73608cabcf42a8ff0ea8e35e745dea23` (not independently verified against Git history)

## Decision

**The corrective changes materially improve v1.9.0, but I cannot close all 14 comments or approve unrestricted release of the affected capabilities.** The original counterexamples exercised in this review are corrected. Related inputs and production-path interactions still expose incomplete fixes, including a report-regeneration regression introduced by history persistence.

Disposition: **5 closed at the targeted code-review level, 8 partially fixed, and 1 implemented with viewer validation pending.** “Closed” here does not mean full release certification: the supported runtime regression and external integrations were not independently executed.

The remaining highest-priority work is API contract correctness, project symlink containment and report regeneration. Keep the shared-core architecture and the reporting feature freeze; these are corrective changes within the existing scope.

## Validation performed

- Compared v1.9.1 source against the previously reviewed v1.9.0 archive.
- Inspected the R01–R14 closure contract, modified production modules, integration callers, workflow gates and release documents.
- `npm run release:static`: PASS, including action SHA pin policy, 507-file static check and LF/CRLF portability contract.
- `node scripts/offline-release-check.mjs`: PASS; 37 JSON, 499 text and 26 required-artifact checks.
- Executed targeted original and expanded counterexamples against the supplied code. Results below distinguish direct module execution from isolated function/helper probes.
- `npm ci --ignore-scripts --offline --no-audit --no-fund`: BLOCKED by absent cached `zod@4.5.4`.
- Full typecheck, Playwright regression, live database TLS tests, browser matrix and fresh dependency audit: NOT independently run. The review runtime is Node 24.19.0; the project supports Node 22.

Probes loaded original TypeScript using Node's type transform and relative-import resolution. An inert YAML import substitute permitted loading JSON/schema helpers; YAML parsing was not tested. MCP argument parsing, CSV formatting and report persistence/materialization helpers were extracted from the source and evaluated unchanged. The MCP handler probe used stub tool dispatch to examine lifecycle and cancellation behavior; it was not a real MCP-client integration test. No product source files were modified.

## R01–R14 disposition

| ID | Original area | Disposition | Reason |
|---|---|---|---|
| R01 | API response/schema validation | **Partial — P1** | Four original invalid values are now rejected; null/enum, `$ref` siblings and boolean schemas still permit false success. |
| R02 | Breaking changes and recursive schemas | **Partial — P1** | Required-parameter addition and ordinary recursive-schema comparison are fixed; parameter case changes and tightened bounds remain undetected. |
| R03 | Database TLS | **Partial — P2 remaining** | Peer verification defaults are corrected across drivers. Strict mode still permits disabled TLS; live certificate tests remain pending. |
| R04 | Project path boundaries | **Partial — P1** | Dot traversal and an individual requirement-file symlink are rejected; source-directory and requirement-root symlinks still cross projects. |
| R05 | MCP evidence provenance | **Closed — targeted code checks** | Caller signals remain UNVERIFIED/non-claimable; caller trust fields are rejected. |
| R06 | Complete classification redaction | **Closed — targeted code checks** | The original fake-secret probe no longer appears in the complete serialized output. |
| R07 | Unsupported classification certainty | **Partial — P2** | Direct ambiguous inputs abstain, but the legacy reporter classifier can still manufacture apparently structured evidence. |
| R08 | Contradictory incident clustering | **Closed — targeted code checks** | Known-defect and flaky signals now form distinct incidents with cause-aware fingerprints. |
| R09 | Occurrence history and integration | **Partial — P1 regression** | Recurrence and replay work in isolation; repeated evidence materialization makes report history conflict. |
| R10 | SQL placeholder rewriting | **Partial — P2** | Original literal/comment examples pass; ordinary parameter positions, JSON operator parameters and SQL Server bracket identifiers fail. |
| R11 | CSV formula safety | **Implemented; viewer validation pending** | Formula-shaped values receive a text prefix. Actual spreadsheet open/save/reopen behavior was not tested. |
| R12 | MCP transport | **Partial — P2** | Malformed-object responses and basic session gate work; notification-only initialization, active cancellation and pre-newline buffering remain gaps. |
| R13 | Ledger append scaling | **Closed — targeted code checks** | New records append incrementally; corrupt record reads fail visibly. Load and crash-recovery qualification remains a release test. |
| R14 | CI action pinning | **Closed — static policy** | External actions are full-SHA pinned and the pin gate passes. Commit availability/provenance was not verified remotely. |

## Remaining comments and reproductions

### R04 — P1: Canonical containment still uses the wrong boundary

Locations: `src/framework/agentic/policy/path-policy.ts:65`; `src/framework/mcp/security-policy.ts:19`.

The target validator checks real-path containment against the repository root. A path can therefore stay within the repository while escaping the selected project:

```text
projects/demo/src/linked -> projects/other/src
assertAgenticTargetPath(root, 'demo', 'projects/demo/src/linked/new.ts')
=> accepted
```

A second probe used a symlink for the entire requirements directory:

```text
projects/alias/requirements -> projects/other/requirements
resolveMcpRequirementPath(root, 'alias', 'secret.md')
=> reads the harmless sentinel from the other project
```

In that case both the file and the supposed trusted requirements root resolve into the other project, so the final comparison succeeds. These probes do not demonstrate source promotion; they demonstrate incorrect target approval and a cross-project requirement read.

**Fix:** Anchor containment to a verified selected-project directory before resolving its subdirectories. Reject project/root/subdirectory symlinks that escape the intended project, or reject symlinks entirely at these boundaries. Validate existing ancestors for future targets against that project root. Repeat the check at actual promotion.

**Closure test:** Cover symlinked project roots, requirements roots, source directories, leaf files, absent targets and supported Windows junctions/separators. The existing R04 test covers only dot traversal and a leaf requirement symlink.

### R01 — P1: Response validation still produces false passes

Locations: `api-contract/schema-validator.ts:42`; `openapi-loader.ts:30`; `response-contract-validator.ts:26`.

| Input | Expected | Observed |
|---|---|---|
| `type:['string','null'], enum:['ok']`, body `null` | Enum violation | `[]` |
| `$ref` to `minimum:10` with sibling `minimum:1`, body `5` | Referenced constraint still applies | `[]` |
| OpenAPI 3.1 response `schema:false`, arbitrary body | Reject every body | `ok:true` |

The null branch returns before checking enum. `$ref` resolution spreads siblings over the target and can weaken referenced constraints. The response validator treats a boolean false schema as absent. These are valid dialect semantics, not requests for unrelated features. [OpenAPI 3.1.1 Schema Object](https://spec.openapis.org/oas/v3.1.1.html#schema-object).

**Fix:** Preserve conjunctive `$ref` sibling semantics, apply enum to null and distinguish absent schemas from boolean schemas. If a form is unsupported, return an explicit unsupported result or error instead of success. A maintained dialect-aware validator remains preferable to expanding a partial implementation without conformance tests.

**Closure test:** Exercise the public response validator using null/enum, conflicting referenced/sibling constraints, boolean true/false schemas and composition. Keep the original four regression cases.

### R02 — P1: Compatibility detection remains incomplete without an incomplete verdict

Locations: `api-contract/breaking-change-detector.ts:50,85`.

The original required-parameter addition is detected, and unchanged recursive schemas terminate. However:

- Renaming required query parameter `Tenant` to `tenant` returns `[]`. The map lowercases names for every parameter location, although query parameter names are case-sensitive.
- Tightening a request schema minimum from 0 to 10 returns `[]`. Previously accepted input is no longer accepted, but bounds are not compared.

**Fix:** Normalize only parameter locations whose semantics allow it, such as header names. Compare supported request restrictions directionally. Explicitly signal incomplete comparison for unsupported constraint families rather than treating no detected changes as a comprehensive compatibility pass. See the [OpenAPI Parameter Object](https://spec.openapis.org/oas/v3.1.1.html#parameter-object).

**Closure test:** Case-only query/header changes must produce different appropriate results. Bounds, enums introduced/removed and composed request schemas need directional compatibility cases.

### R09 — P1: History integration breaks repeated report generation

Locations: `reporting/business-dashboard.writer.ts:55,72,140`; `failure-intelligence/failure-history.store.ts`, immutable conflict check.

A probe ran the actual materialization, classification and history-persistence helpers twice for identical facts from the same run:

```text
First build:  evidence/chromium-s1/trace.zip   -> PASS
Second build: evidence/chromium-s1/trace-2.zip -> FAILURE_HISTORY_CONFLICT
```

Materialization uses `uniquePath`, so the second build changes the evidence reference. History uses the same occurrence identity but compares the complete classification, including that reference. The writer invokes persistence before writing the failure page and main index; an exception can leave a partially refreshed bundle.

The isolated R09 test replays an unchanged classification. It does not exercise materialization, which is where the conflict arises. Three distinct run occurrences and exact replay passed independently.

**Fix:** Give evidence stable, idempotent artifact identities and keep immutable execution evidence separate from presentation-relative URLs. Regenerating a view should not change an occurrence's historical meaning. Preserve real conflict detection; do not simply swallow this exception or overwrite history.

**Closure test:** Generate the same complete bundle twice with traces/screenshots, rebuild from persisted facts and merge shard reports. Verify stable links, no duplicate history and complete output. Repeat on supported browsers/platforms where the workflow applies.

### R07 — P2: Legacy text heuristics are still promoted to structured evidence

Locations: `src/framework/ai/failure.classifier.ts`, `classifyFailure`; `failure-intelligence/report-adapter.ts:21`; `deterministic-classifier.ts:58`.

The following production-function chain was reproduced:

```text
error: "schema editor failed to load"
legacy classifyFailure -> DATA_DEFECT
report adapter         -> testDataSignal = error
new classifier         -> TEST_DATA_FAILURE / HIGH / claimEligible=true
```

No trace or actual invalid test-data evidence was supplied. The result recommends no human confirmation. The adapter still transfers legacy TEST_DEFECT/DATA_DEFECT/ENVIRONMENT categories into fields that the new classifier treats as structured signals.

**Fix:** Track provenance of each signal. Legacy keyword categories must remain heuristic, not become structured producer evidence. Populate confirmed data/auth/contract/environment signals through typed producers that supply evidence references.

**Closure test:** Test legacy classifier → execution facts adapter → new classifier, using ambiguous messages containing “schema”, “certificate”, “waiting for” and other keywords. Direct classifier tests alone do not close this finding.

### R10 — P2: The new SQL tokenizer rejects or changes ordinary SQL

Location: `database/sql-placeholder.ts:80`; `database/postgres.database.ts`, query method.

| SQL | Observed rewrite |
|---|---|
| PostgreSQL `SELECT ? AS value` | Unchanged, parameter count 0 |
| PostgreSQL `SELECT data ? ? FROM t` | `SELECT data $1 $2 FROM t`, count 2 |
| SQL Server `SELECT [what?] FROM t WHERE id = ?` | `SELECT [what@p0] FROM t WHERE id = @p1`, count 2 |

The PostgreSQL heuristic sees the letters surrounding a placeholder as a binary operator. A JSON existence operator with a parameter on its right is rewritten as a parameter itself. SQL Server bracket identifiers have no tokenizer state. The native `$1` workaround mentioned in the helper comment is not usable with values through the current PostgreSQL adapter: its rewritten question-mark count is zero, so its parameter-count check rejects them. PostgreSQL documents the binary `?` JSON existence operator in its [JSON operator reference](https://www.postgresql.org/docs/current/functions-json.html).

**Fix:** Support explicit dialect-native parameters, a maintained query builder, or a documented unambiguous placeholder format. If retaining tokenization, handle actual dialect lexical rules and reject unsupported forms explicitly.

**Closure test:** Execute representative queries through the real drivers, including positional expressions, JSON operators with bound values, bracket identifiers and count mismatches.

### R03 — P2: Strict TLS does not enforce transport encryption

Location: `database/database-tls.ts:13`.

Certificate verification with `DB_SSL=true` is now correctly enabled, and an insecure verification override in CI throws. However:

```text
resolveDatabaseTlsPolicy({CI:'true', DB_TLS_STRICT:'true', DB_SSL:'false'})
=> {enabled:false, rejectUnauthorized:true}
```

The function returns before evaluating protected-runtime policy. Unknown SSL mode strings also fall into disabled TLS. This is a residual transport-policy issue, not a claim that the original certificate-verification defaults remain unfixed.

**Fix:** Validate the SSL mode enum and make the meaning of strict mode explicit. When strict mode requires encryption, reject disabled/missing/unknown SSL settings before returning. Do not require encrypted local development databases unless policy calls for it.

**Closure test:** Test strict mode with enabled, disabled, absent and misspelled SSL settings, then exercise valid and invalid certificates on PostgreSQL/MySQL/SQL Server. Those network integration tests remain pending.

### R12 — P2: MCP transport fixes cover helper behavior more than transport behavior

Location: `mcp/server.ts:31,32,68`.

Confirmed fixes: `null` receives `-32600`; tools are blocked in an uninitialized session; product version is read from package metadata; completed-line size and active request count have checks.

Remaining gaps:

- Sending only `notifications/initialized` sets the session initialized and allows tools without an initialize request/response exchange.
- Cancellation stores a request ID and is checked before invocation. It does not interrupt an already active operation. With delayed stub dispatch, cancellation followed by completion still returned the normal tool result. Cancellation is cooperative in MCP, but the implementation currently has no connection to active work; the existing test checks cancellation before work begins.
- `readline` buffers until newline before the byte check runs. The configured byte budget does not bound a peer's unterminated input buffer.

**Fix:** Use explicit lifecycle states; connect active request IDs to cancellation signals; cap bytes while assembling frames, before newline. Ensure cancellation/control notifications remain serviceable at capacity. [MCP cancellation specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/utilities/cancellation).

**Closure test:** Add a real child-process stdio test for malformed frames, notification-only initialization, an unterminated oversized frame, active cancellation and concurrency saturation.

## Closed items and remaining qualification

**R05:** Strict extra-field checks reject caller trust flags. Ordinary MCP signals now produce UNVERIFIED, LOW/non-claimable results rather than LIVE facts. This closes the reproduced provenance-escalation defect.

**R06:** The original token in title/contract/URL probe is absent from the serialized output. Retain fake-secret coverage across the complete public object, not only normalized signatures.

**R08:** Known-defect and flaky inputs with the same symptom now produce two incidents. Cause-aware identity resolves the reproduced contradictory-category merge. This does not establish statistical clustering accuracy on real failures.

**R11:** The CSV formatter changes `=1+1` to a quoted, apostrophe-prefixed text value. That is a concrete improvement. The test's `toContain("'")` assertion proves a prefix, not spreadsheet safety across supported viewers. Complete the original open/save/reopen acceptance test before claiming universal safety.

**R13:** New decision records no longer rebuild the entire JSONL history. Appending two records and reading both passed; corrupt record reads fail visibly. Replay uses a scan to repair the convenience view, so replay-heavy performance differs from new-record performance. Benchmark and process-kill testing should qualify operational scale, not block acknowledgement that the original per-append full rebuild was fixed.

**R14:** Full-SHA pinning and the enforcing static gate are present and pass. This closes the floating-reference issue. SHA format checks alone do not establish that a commit exists or is a reviewed upstream release.

## Release handoff inconsistency — P2

The external filename says `CERTIFIED`, but these bundled documents still say v1.9.1 is an uncertified corrective candidate:

- `README.md`, current release state;
- `REVIEW-HANDOFF-v1.9.1.md`;
- `docs/41-CURRENT-RELEASE-STATUS.md`;
- `docs/65-v1.9.1-INDEPENDENT-REVIEW-CLOSURE.md`;
- `docs/66-v1.9.1-REVIEW-VALIDATION.md`.

This does not prove your external CI failed or that certification did not happen after those documents were written. It means the reviewed artifact does not provide a consistent certification handoff. Synchronize the release status with actual evidence: exact source commit, supported-runtime results, CI run IDs, compatibility runs, security audit and final archive digest. Keep v1.9.0's immutable tag unchanged.

## Product and architecture recommendation

The fixes are worth retaining. Avoid another broad feature release until these remaining correctness cases are resolved. The most useful next investment is a set of tests through the real public workflows, supported by a small conformance corpus for custom schema/SQL/protocol code.

The current closure suite usefully maps one test to each finding, but several assertions target the exact example rather than the broader contract. Extend those tests around boundary variations and producer/consumer interactions. In particular, add a repeat-report-generation test before releasing any further history integration.

**Suggested order:** R04 project scope; R01/R02 contract checks; R09 report idempotency; R07 producer provenance; R10 SQL; R03/R12 policy and transport; R11 viewer qualification. Then run Node 22 typecheck, closure tests, full regression, security checks and compatibility gates on the exact deliverable, and update the release handoff from that evidence.
