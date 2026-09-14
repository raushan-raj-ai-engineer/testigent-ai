# TestigentAI v1.9.0 — Independent Architecture and Product Review

Review date: 14 September 2026  
Reviewed input: `TestigentAI-v1.9.0-REVIEW.zip`  
Archive SHA-256: `228fe5a7544a116621a3e679a8b411d1a35e3761c780b5765798a6d62865ccac`

## Decision

**Retain the architecture and invest in a corrective hardening release before a broad enterprise rollout.** The shared-core design is useful and the product has a credible direction. However, reproduced defects in contract checking, project boundaries, evidence provenance and sanitization mean that I would not approve unconditional enterprise-readiness claims from this snapshot.

A controlled internal pilot remains reasonable with the affected features restricted and risks explicitly owned. Release readiness should be decided per enabled capability: the findings do not mean every ordinary UI or API test is broken.

There are **14 prioritized review comments: six P1 and eight P2**. P1 means fix before broad rollout of the affected capability. P2 means schedule for the next hardening cycle, with an explicit restriction if users encounter the affected case. No P0 outage or demonstrated remote code execution was established.

## Evidence and limits

This review inspected the supplied source, tests, configuration, CI definitions, release metadata and relevant documentation. The source inventory contains 174 TypeScript files under `src`, approximately 15,369 source lines, 198 npm commands and 70 entries directly under `docs`. These counts describe maintenance surface, not code quality scores.

Independently executed:

| Check | Result |
|---|---|
| `npm run release:static` | PASS; 498 files checked; LF and CRLF portability contract passed |
| `node scripts/offline-release-check.mjs` | PASS; 37 JSON, 490 text and 26 required-artifact checks |
| Targeted source-level probes | Confirmed validation, classification, clustering, path, sanitization and history defects described below |
| Locked dependency installation | BLOCKED: offline cache missing `zod@4.5.4` |
| Full typecheck, 187-test framework regression, browser matrix, live DB/provider tests and fresh dependency audit | NOT independently rerun |

The review runtime is Node 24.19.0; the project explicitly supports Node 22. Targeted probes loaded the original TypeScript through Node's type-stripping transform and relative-import resolution. An inert YAML import substitute was used only to load the OpenAPI module; no YAML parsing was exercised. The MCP parser and CSV formatter probes evaluated those functions extracted from the original source. These are function-level counterexamples, not a substitute for certification on the supported runtime.

The ZIP records passing local validation, 187/187 tests, dependency security checks, CI reruns and a five-entry compatibility matrix. Those are **supplied certification claims**, not independently verified remote runs. The ZIP also distinguishes a certified commit from a later documentation synchronization commit. The review is bound to the archive hash above; no Git history was available to verify that distinction.

## What is worth preserving

- Reusable capability under `src/framework`, with application behavior in `projects/<project>`, is an appropriate foundation for multiple teams.
- Project facades and fixtures provide a useful dependency-injection boundary. API/data/DB tests can avoid browser initialization.
- Healing is deterministic-first, resolves AI lazily, audits recovery, and requires semantic verification before caching dynamic recovery. Keep these safeguards.
- AI destination allowlists and opt-in execution are stronger than provider-name-only controls.
- Generated proposals retain mandatory human approval. The path findings below do not demonstrate automatic source promotion.
- Reporting distinguishes execution, quality outcomes, retries and known defects; the shared bundle writer reduces divergence between entry points.
- The synthetic showcase, scale evidence and provider health models explicitly represent uncertainty. Keep that intent and enforce it at every ingestion boundary.
- Locked dependencies, compatibility jobs, static gates and security fail-closed behavior are useful release engineering investments.

## Prioritized review comments

### R01 — P1: Contract validation can return success for invalid bodies

**Evidence:** `src/framework/api-contract/schema-validator.ts:10,32,44`; `openapi-loader.ts`, `validateDocument`.

Four probes returned zero violations:

| Schema | Invalid value | Actual |
|---|---|---|
| `{type:'integer', minimum:1}` | `-5` | `[]` |
| `{type:'object', additionalProperties:false}` | `{unexpected:1}` | `[]` |
| `{type:'object', required:['id'], allOf:[{type:'object'}]}` | `{}` | `[]` |
| OpenAPI 3.1 `{type:['string','null']}` | `42` | `[]` |

The composition branches return before sibling constraints run. Additional-property enforcement depends on `properties` existing. Unsupported type forms fall through to success. The loader accepts any `3.x` version while the validator implements a limited subset. Minimum and other unsupported constraints are silently ignored.

**Impact:** A contract gate can give false assurance that an invalid response satisfies its schema.

**Required change:** Use a maintained validator appropriate to each supported OpenAPI/JSON Schema dialect, or explicitly reject unsupported versions/keywords. A limited subset is acceptable only when unsupported contracts cannot silently pass. Preserve the distinction between invalid response and unsupported contract.

**Acceptance:** All four counterexamples fail or explicitly report unsupported validation; composition siblings, nullability, references, bounds and additional properties have independent negative tests. Owner: API framework maintainer.

### R02 — P1: Breaking-change detection misses required parameters and crashes on recursive schemas

**Evidence:** `src/framework/api-contract/breaking-change-detector.ts:38,50`.

Adding a required `tenant` query parameter to an existing GET operation returned `[]`. `compareRequests` checks request bodies but does not compare operation/path parameters. Comparing an unchanged valid self-referential `Node` schema against itself produced `RangeError: Maximum call stack size exceeded`; schema-pair recursion has no visited-pair guard.

**Impact:** A compatibility command can miss a consumer-breaking change or fail on ordinary recursive models.

**Required change:** Define compatibility coverage, compare path/query/header/cookie parameters and their inherited definitions, and use cycle-aware schema comparison. Keep request and response compatibility direction explicit. Return incomplete/unsupported when coverage is insufficient for a clean verdict.

**Acceptance:** Required-parameter additions are detected; unchanged recursive schemas terminate with no changes; genuine recursive-schema changes remain detectable. Owner: API contract maintainer.

### R03 — P1: Database TLS settings bypass server identity verification

**Evidence:** `src/framework/database/postgres.database.ts:17`; `mssql.database.ts:20`; `mysql.database.ts` constructor.

PostgreSQL enables SSL with `rejectUnauthorized:false`. SQL Server always sets `trustServerCertificate:true`, including when encryption is enabled. The MySQL adapter exposes no SSL option in its pool configuration.

**Impact:** Encryption can be enabled without authenticating the database server. The MySQL configuration cannot express the equivalent secure connection policy through the existing adapter. This was confirmed by code inspection, not a live interception test.

**Required change:** Verify certificates by default; support configured trust roots and required encryption. Make any development-only verification exception explicit and reject it under a strict CI/release policy. Use typed driver configurations so required options are visible.

**Acceptance:** Valid trusted certificates work; invalid/self-signed certificates fail unless an explicitly permitted development exception is set. Exercise all three drivers. [node-postgres SSL documentation](https://node-postgres.com/features/ssl).

### R04 — P1: Project path enforcement is lexical and can be bypassed

**Evidence:** `src/framework/agentic/policy/path-policy.ts:11,21`; `src/framework/mcp/security-policy.ts:8`; `agentic/generator/test-generator.ts`; `agentic/reviewer/generated-test-reviewer.ts`.

A harmless symlink under `projects/demo/requirements/link.md` pointing to another project's requirement was accepted by `resolveMcpRequirementPath`, and the target content was readable. The target `projects/demo/../other/src/new.ts` also passed `assertAgenticTargetPath`. A proposal with that path passed deterministic review with no findings and remained `REVIEW_REQUIRED`.

**Impact:** The selected-project boundary does not hold for requirement reads or generated proposal targets. The demonstrated outcome is cross-project reading and incorrect proposal validation; source writing was not performed and human approval remains required.

**Required change:** Canonicalize before checking containment. For existing files, validate real paths. For future targets, resolve and validate existing ancestors, reject symlink traversal or apply a documented symlink policy, and check containment against the selected project's permitted subdirectories. Return the canonical safe relative path. Revalidate at the actual promotion boundary. Reject `.` and `..` in every path-segment helper, including the ledger helper.

**Acceptance:** Cross-project symlinks, symlinked directories, dot segments, Windows separators and absent target files are covered. No denied path is read or proposed as valid. Owner: security/core maintainer.

### R05 — P1: MCP caller data is automatically upgraded to LIVE claim-eligible evidence

**Evidence:** `src/framework/mcp/tool-registry.ts:168–175`, `parseFailureSignal`.

The parser unconditionally sets `evidenceMode:'LIVE', synthetic:false, claimEligible:true`. Its runtime checks ignore unknown properties despite the advertised `additionalProperties:false` schema. A probe passing explicit synthetic/showcase flags plus a demo known-defect identifier emerged as a HIGH-confidence, LIVE, claim-eligible known defect. Even a schema-conforming caller can submit invented evidence because live provenance is never verified.

**Impact:** A demonstration or model-authored object can acquire a misleading trust label. The current triage tools are in-memory; this review did not demonstrate automatic persistence into production history.

**Required change:** Validate the actual tool input with a strict runtime schema. Treat free-form caller signals as unverified and non-claimable. Resolve trusted evidence by server-owned run/artifact identifiers before assigning LIVE or claim eligibility. Do not solve this by simply allowing callers to supply their own trust flags.

**Acceptance:** Extra fields are rejected; hypothetical/model-generated signals remain non-claimable; only server-verified evidence can acquire trusted status. Owner: MCP/evidence maintainer. This is relevant to the data and authority boundaries described by [OWASP's GenAI risks](https://genai.owasp.org/llm-top-10/).

### R06 — P1: Failure classification does not sanitize its complete output

**Evidence:** `src/framework/failure-intelligence/deterministic-classifier.ts:23,49`; `failure-history.store.ts`; `reporting/failure-intelligence.renderer.ts`.

A probe with a harmless `token=probe-only-secret` in `contractViolation` and an endpoint query showed a sanitized normalized signature, but the token remained in `rationale` and `evidenceRefs`. Title and other copied fields similarly do not pass a final output sanitizer. The renderer HTML-escapes rationale; escaping does not redact secrets. The history store serializes accepted classification records directly.

**Impact:** Sensitive values can propagate through MCP results and, for callers persisting or rendering those records, into durable evidence. Upstream redaction in some paths does not protect the public classifier boundary.

**Required change:** Apply centralized structured redaction and URL sanitization before returning or persisting classification objects. Preserve raw evidence only in an explicitly protected store if required.

**Acceptance:** Seed fake secrets/PII into every free-text and URL field and assert their absence from the full serialized classification, MCP output, HTML and stored record. Owner: evidence/security maintainer.

### R07 — P2: Classification confidence exceeds the available evidence

**Evidence:** `src/framework/failure-intelligence/report-adapter.ts:31–32`; `deterministic-classifier.ts:48–59`.

`Timeout waiting for contract tab` became HIGH-confidence `API_CONTRACT_FAILURE` because the adapter treats the word “contract” as proof of a violation. An authenticated 503 with no endpoint or trace became HIGH-confidence `PRODUCT_DEFECT`, claim eligible, with no human confirmation recommended. A missing UI element is not by itself proof that automation, rather than the product, is defective.

**Impact:** Triage can route work to the wrong owner and make a report appear more certain than the evidence warrants. Deterministic execution does not establish classification accuracy.

**Required change:** Separate observed symptom, suspected cause and confirmed cause. Populate auth, HTTP, contract and healing facts from structured evidence; treat text matching as an explicit low-confidence heuristic. Require provenance before HIGH-confidence claims.

**Acceptance:** Ambiguous timeout/503/locator cases remain UNKNOWN or tentative. Evaluate on a held-out, human-labelled failure corpus and publish confusion matrices, category precision and abstention rate. Owner: failure-intelligence/product owner.

### R08 — P2: Incident clusters can combine contradictory categories

**Evidence:** `failure-intelligence/failure-fingerprint.ts`; `failure-analyzer.ts:28–44`.

Two signals with the same error but one known-defect ID and one flaky outcome generated the same fingerprint. The summary contained one known defect and one flaky classification, while the single cluster inherited the first record's known-defect category and recommendation. Reversing inputs can change that inherited interpretation.

**Impact:** Incident counts and blast-radius recommendations may misrepresent distinct causes.

**Required change:** Define a separate symptom signature and incident identity. Include category/reason or represent conflicts explicitly; use service/environment scope when appropriate. Retain cross-application correlation only when shared dependency evidence supports it.

**Acceptance:** Input order does not change cluster meaning; conflicting categories remain separate or visibly ambiguous; volatile IDs still normalize correctly. Owner: failure-intelligence maintainer.

### R09 — P2: Failure history lacks a usable occurrence identity and production wiring

**Evidence:** `failure-intelligence/failure-history.store.ts:16`; `reporting/business-dashboard.writer.ts:52`; repository reference search for `FailureHistoryStore`.

History files are keyed only by fingerprint and scenario ID. Appending the same incident/scenario with a new run's trace reference raised `FAILURE_HISTORY_CONFLICT`. Exact duplicates collapse rather than recording recurrence. The class is referenced by its contract test but no production caller was found in `src` or `scripts`; dashboard generation analyzes the current run without using this store.

**Impact:** The new history capability does not yet support dependable cross-run recurrence. This is specific to FailureHistoryStore, not a claim that the product has no other report history.

**Required change:** Separate incident identity from immutable occurrence identity, including project/environment/run/attempt where appropriate. Add schema validation and observable corruption handling. Integrate persistence/correlation deliberately or document the store as an unintegrated extension point.

**Acceptance:** Three runs produce three immutable occurrences, replaying the same occurrence is idempotent, recurrence is discoverable through a supported workflow, and showcase data is rejected. Owner: reporting/evidence maintainer.

### R10 — P2: SQL placeholder rewriting can change SQL meaning

**Evidence:** `database/postgres.database.ts:22`; `database/mssql.database.ts:26`.

Both adapters replace every `?`, including those inside quoted literals, comments and PostgreSQL JSON operators. For example, the literal in `SELECT '?' AS label WHERE id = ?` is rewritten as though it were a parameter. This is a correctness finding from the transformation; no SQL injection exploit was demonstrated.

**Required change:** Prefer dialect-aware query builders or explicit driver-native parameters, or implement a properly tested SQL tokenizer for the supported subset. Do not promise general SQL portability based on string replacement.

**Acceptance:** Literal/comment question marks, JSON operators, missing/excess parameters and driver-specific data types are covered by real driver integration tests. Owner: database maintainer.

### R11 — P2: CSV exports do not neutralize spreadsheet formulas

**Evidence:** `reporting/business-dashboard.writer.ts:120`, `csvCell`.

The exact formatter converted the harmless input `=1+1` into `"=1+1"`. CSV quoting does not force a spreadsheet to treat the contents as text. Scenario titles, defect descriptions and other textual metadata flow into the export.

**Impact:** An attacker-controlled title/metadata field could become a spreadsheet formula when someone opens the report. No spreadsheet exploit or external request was executed.

**Required change:** Define separate human-view and machine-consumption export contracts. For human spreadsheet exports, neutralize formula prefixes and test the supported spreadsheet applications; consider XLSX with explicit text cell types. Preserve unmodified data in JSON where appropriate.

**Acceptance:** Benign formula-shaped inputs remain text in supported viewers, including save/reopen workflows, without breaking quotes/newlines. [OWASP CSV injection guidance](https://community.owasp.org/attacks/CSV_Injection).

### R12 — P2: Handwritten MCP transport needs malformed-input and lifecycle hardening

**Evidence:** `mcp/server.ts:17,43`.

`JSON.parse('null')` succeeds, but the handler dereferences `message.jsonrpc` before validating an object. The outer catch writes stderr rather than a protocol error response. The transport launches work for each line without an explicit line-size or concurrency limit, and the handler carries no initialized-session state. Tool argument schemas are only partly enforced. Server metadata is also hardcoded to version 1.7.0 in a 1.9.0 package.

**Impact:** A malformed client can cause missing responses and uncontrolled request accumulation; capabilities and diagnostic metadata can drift. This was assessed from the transport source, not a live MCP client compatibility matrix.

**Required change:** Prefer the maintained MCP SDK if it fits the supported runtime; otherwise add schema validation, byte/request budgets, lifecycle state, bounded concurrency and cancellation. Derive product version from package metadata.

**Acceptance:** Null/scalar/array payloads, invalid IDs and arguments, oversized lines, cancellation, initialization and repeated requests have protocol-level tests. [MCP lifecycle specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle).

### R13 — P2: Decision-ledger appends repeatedly rebuild full history

**Evidence:** `agentic/evidence/agent-decision-ledger.ts:141,152,200`; `adoption/adoption-store.ts`, append/export methods.

Each decision append reads and sorts the full decision directory, then rewrites JSONL under a synchronous lock. Across N appended records this implies at least quadratic cumulative record processing, plus sorting. Similar full exports occur in the adoption store. This is an algorithmic finding, not a measured latency claim. Immutable creation also does not make these files tamper-evident after creation; readers largely trust schema-shaped records.

**Impact:** Long runs and concurrent tooling may spend increasing time on serialization and locks. A damaged or edited record may silently change summaries or disappear.

**Required change:** Retain immutable per-record writes and export in batches/on demand, or use an indexed transactional store when measurement warrants it. Add observable read failures and clearly distinguish write-once API semantics from tamper-evident audit storage.

**Acceptance:** Measure append p50/p95, lock wait, report generation, memory and file counts at representative scales. Kill a writer mid-operation and verify recovery without duplicate/lost records. Owner: core/evidence maintainer.

### R14 — P2: CI actions are pinned to mutable tags

**Evidence:** `.github/workflows/playwright-sharded.yml` and `release-compatibility.yml`, for example `actions/checkout@v7` and `actions/setup-node@v7`.

The lockfile pins npm dependencies, but action tags remain mutable. This is a supply-chain hardening gap, not evidence that any referenced action is compromised or unavailable.

**Required change:** Pin actions to reviewed full commit SHAs and automate controlled updates. Preserve the human-readable release version in comments. Bind release evidence and downloadable archive digests to the exact release commit.

**Acceptance:** A workflow policy rejects floating action references; update PRs rerun compatibility tests; published checksums identify the reviewed archive. [GitHub secure-use guidance](https://docs.github.com/en/actions/reference/security/secure-use).

## Product-owner assessment

**Recommended positioning:** a governed, repository-owned Playwright quality framework for teams managing several applications, with auditable assistance and business-readable evidence. This is a coherent buyer need. A hosted, multi-tenant quality platform would require a separate operational and access-control design; folder boundaries alone should not be sold as tenant isolation.

Market documentation already describes detailed steps, logs, screenshots, flaky-test visibility, historical results and failure grouping. Those are baseline expectations rather than sufficient differentiation. [Allure Report](https://allurereport.org/) and [Allure TestOps documentation](https://docs.qameta.io/) provide concrete examples. This is a capability comparison, not a hands-on competitive benchmark or evidence of either product's performance.

| Product priority | Review comment | Evidence needed before a strong claim |
|---|---|---|
| Trustworthy triage | Fix R05–R08 before emphasizing root-cause intelligence | Held-out labelled failures; precision by category; false certainty; human override rate; time saved |
| Safe assistance | Make scope, provenance and human approval unavoidable | Adversarial boundary tests; unsafe-action rejection; semantic false-heal evaluation |
| Fast adoption | Preserve `qa` as the main entry point; organize 198 commands into a small recommended workflow | Fresh-checkout pilot with users who did not build the framework; time to first UI/API pass and first useful report |
| Existing-suite compatibility | Develop the migration-assessment capability into a low-friction adoption path | Import an existing Playwright suite; identify required changes and quantify migration work |
| Maintainable distribution | Keep the current monolith until public interfaces justify extraction; then consider versioned core/CLI packages | Documented extension points, compatibility policy, upgrade tests and rollback procedure |
| Evidence interoperability | Prefer versioned JSON/contracts and existing CI/reporting integration over adding more custom panels | Demonstrated export/import without losing outcomes, retries, evidence references or provenance |
| Measured scale | Keep synthetic planning separate from execution proof | Real 100/500/2,000-case runs where relevant; CPU/RSS, report time, artifact size, shard imbalance and duplicate/drop counts |
| Operable enterprise usage | State the deployment model and ownership boundaries clearly | Supported-runtime matrix, retention/backup policy, secret handling, upgrade ownership and support expectations |

The repository already contains adoption and benchmark tooling. Use it to gather externally reviewable evidence, rather than building another measurement subsystem. A digest of supplied data establishes which bytes were supplied; it does not independently establish that a measurement occurred. Retain raw run artifacts and the measurement method alongside any business claim.

Suggested pilot targets should be agreed with users and measured against their baseline, not described as universal market standards. Useful measures are median/p90 time to first passing test, triage minutes, clean-pass versus retry-pass rates, false-heal rate with sample size, generation approval rate, migration effort, and CI/report overhead.

## Delivery sequence and release acceptance

1. **Correctness and boundaries:** R01–R06. Disable or constrain affected capabilities until their counterexamples are covered. Use one canonical path policy and one trust/provenance contract.
2. **Triage and workflow hardening:** R07–R12. Test the complete chain from evidence ingestion to classification, rendering and persistence; add driver integration and MCP protocol tests.
3. **Operational hardening:** R13–R14. Measure storage/locking behavior and pin CI dependencies.
4. **Pilot and market validation:** Run representative projects with real users, publish the measured results and update positioning based on observed benefits.

Treat the reporting freeze as protection against uncontrolled feature expansion. Security, incorrect evidence and export defects require governed corrective changes within that freeze. Preserve existing bundle names, outcome definitions, evidence links and interactive behavior unless a migration is explicit.

Before closing the review:

- Every P1 counterexample has a regression test exercising the actual public boundary, not just matching source text.
- The supported Node 22 environment passes typecheck, framework regression, security checks and the existing compatibility matrix.
- UI/API/DB execution and report generation are tested together where a finding crosses those boundaries.
- New evidence inputs remain untrusted by default, and synthetic data cannot become claim-eligible through MCP or other adapters.
- The reviewed release artifact is traceable to its exact commit and checksum.
- Any remaining P2 has an owner, acceptance criteria and a documented operational restriction where necessary.

**Architecture judgment:** Keep the foundation. Correct the trust and contract boundaries before expanding scope. **Product judgment:** Prove safer automation and faster triage with customer measurements; the number of features and passing internal checks alone is not enough to establish market advantage.
