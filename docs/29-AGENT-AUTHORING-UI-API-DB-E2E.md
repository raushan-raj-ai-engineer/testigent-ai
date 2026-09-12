# Agent-Driven Automation Authoring — UI, API, Database and E2E

## Purpose

TestigentAI uses one governed authoring lifecycle for UI, API, database and mixed-layer E2E automation. AI/coding agents may accelerate analysis and implementation, but generated code remains a **proposal** until a named human reviewer approves and promotes it.

```text
Requirement + approved evidence
          ↓
Requirement analysis / test plan
          ↓
Layer-aware proposal scaffolding
          ↓
Coding agent implementation
          ↓
Architecture + type + proposal validation
          ↓
Named human approval
          ↓
Promotion into normal project automation
          ↓
Standard CI / business reporting
```

## One command surface

```bash
npm run qa:use -- <project> <environment>
npm run qa:doctor
npm run qa:new -- <requirement-id-or-file>
```

`qa:new` keeps the existing `PLAYWRIGHT_AUTHORING_PROMPT.md` filename for backward compatibility, but the prompt is layer-aware and covers UI, API, DATABASE and cross-layer E2E authoring.

## Evidence by layer

| Layer | Approved evidence | Generated/project-owned destination |
|---|---|---|
| UI | live browser through Playwright CLI/MCP/Test Agents, approved application knowledge | `src/pages`, `src/workflows`, `app.facade.ts` |
| API | requirement, OpenAPI/Swagger, Postman/contracts, approved observed service behavior | `src/api`, API facade |
| DATABASE | approved schema/data dictionary/migrations, existing repository patterns | `src/database`, repository facade |
| E2E | correlated business identity and approved evidence from each participating layer | business spec using project facades |

Agents must not invent routes, payload fields, selectors, database identifiers, credentials or expected results.

## UI authoring

UI code follows:

```text
Business Spec -> Project Fixture/App Facade -> Workflow -> Page -> BasePage/HealingOrchestrator
```

Runtime locator recovery order is:

```text
primary -> deterministic fallback -> semantically validated cache -> lazy AI fallback
```

Dynamic recovery is trusted/cached only after a semantic business post-condition passes.

## API authoring

Generated API code belongs in a project domain service behind the `api` facade. Business specs do not construct `APIRequestContext` or framework clients directly.

Agents may propose positive, negative, boundary, schema/contract, pagination and authorization coverage **only when supported by the approved requirement/contract**. They must not rewrite an expected HTTP status or silently change an endpoint to make a failing test green.

## Database authoring

Generated database validation is **read-only by default**:

- parameterized SQL in project repositories;
- schema/table/column names from approved evidence;
- no generated `INSERT`, `UPDATE`, `DELETE`, `MERGE`, `DROP`, `TRUNCATE` or `ALTER` paths in review-gated validation proposals;
- business specs consume the repository facade, never raw connections.

Test data setup that legitimately mutates a database should use an explicitly human-owned/approved setup path rather than being generated silently into a validation repository.

## Cross-layer E2E

A mixed UI/API/DB scenario should prove one business outcome with a correlated identifier, for example:

```text
Create order through API
       ↓ orderId
Verify persisted order through repository
       ↓ same orderId
Verify order is visible in UI
```

The business spec coordinates intent. Technical clients stay behind project facades.

## Human approval lifecycle

```bash
npm run proposal:list
npm run proposal:show -- <requirement-id>
npm run proposal:validate -- <requirement-id>
npm run architecture:check
npm run typecheck
npm run test:authoring:contract

npm run proposal:approve -- <requirement-id> --reviewer="<name>"
npm run proposal:promote -- <requirement-id>
```

Approval stores exact file hashes. Any change after approval invalidates trust and requires another review.

## Safety rules

- Generated code never auto-commits or auto-merges.
- Human-owned active files are not overwritten silently.
- Generated API services must use the project/framework domain-client boundary.
- Generated DB validation remains read-only by default.
- AI cannot weaken assertions, auth/security rules or business expectations.
- Runtime AI is not required for agent authoring; authors may use deterministic coding/browser tools without enabling LLM execution in tests.
