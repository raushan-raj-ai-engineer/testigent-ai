# TestigentAI Declarative Authoring — Deep Research and Architecture Decision

## Executive conclusion

TestigentAI should keep declarative YAML as a **governed low-code UI authoring layer**, not turn YAML into a second programming language. The strongest pattern across modern automation products and the underlying standards is a layered experience: users should be able to discover supported capabilities, receive schema-driven completion and validation while authoring, validate before browser execution, and move to code when the scenario needs programming constructs or cross-layer orchestration.

The v1.2.0 implementation therefore treats the declarative contract as a product API. It adds a versioned scenario contract, IDE schema, capability catalog, CLI help/scaffolding/validation/run/doctor commands, automatic project scenario discovery, one-scenario-per-Playwright-test reporting, application-root-aware navigation, cross-origin governance, contract tests, and release-gate enforcement. TypeScript remains the primary path for complex flows.

## Research findings

### 1. A schema is the right authoring contract

JSON Schema Draft 2020-12 is the current published JSON Schema specification and is designed for structural validation plus metadata that can assist tools and interfaces.[1] That makes it suitable for expressing the legal shape of a TestigentAI scenario without coupling authoring to one editor.

The Red Hat YAML Language Server and VS Code YAML extension use JSON Schema to provide validation, key/value completion, hover descriptions, defaults, and schema-aware editing. They support schema association through a modeline, an inline `$schema` property, or workspace `yaml.schemas` settings.[2][3] This means a committed TestigentAI schema can give immediate feedback before a test is executed.

**Decision:** ship a committed Draft 2020-12 schema, associate it with `projects/*/data/scenarios/**/*.yaml`, recommend the Red Hat YAML extension, and insert a schema modeline in newly scaffolded scenarios.

### 2. Runtime and editor validation must not drift

TestigentAI already depends on Zod 4.5.x. Zod 4 has first-party JSON Schema capabilities and metadata support.[4][5] Runtime parsing with Zod is valuable because it gives typed, fail-fast validation before the runner touches the browser.

A raw generated schema is not always the best IDE artifact: low-code users benefit from curated descriptions, examples, and a stable layout. v1.2.0 therefore uses the same action, locator, role, and version constants in the runtime contract and schema builder, then adds contract checks so the human-facing catalog and generated editor schema cannot silently diverge.

**Decision:** Zod remains the runtime validator; the committed JSON Schema is deterministically built from the shared DSL constants and checked by `scenario:doctor`.

### 3. Locator guidance should follow Playwright’s resilience model

Playwright recommends user-facing locators and explicit contracts, especially `getByRole()`, and also documents text, label, placeholder, alt-text, title, and test-id locators.[6] Its test generator prioritizes role, text, and test-id locators because they tend to produce more resilient tests.[7]

**Decision:** expose `role`, `label`, `text`, `testId`, `placeholder`, `altText`, and `title` in YAML; retain `css` only as an advanced fallback. The CLI and documentation explicitly recommend semantic locators first.

### 4. Low-code needs visible capability boundaries

BrowserStack positions low-code automation as a bridge for testers who do not want to write code, with a recorder, validations, data-driven features, modules, and supported action lists.[8][9] Its newer agentic authoring also structures natural-language intent into concrete test steps and validates/replays automation before saving it.[10]

Katalon makes the boundary even clearer: Manual view uses keyword-driven steps, while Script view is recommended for code-level control including variables, methods, conditions, loops, and exception handling.[11][12] This is a useful product lesson: low-code succeeds when users can see what is supported and know when to move to code.

**Decision:** `npm run scenario:help` is a capability contract, not just help text. It lists actions, locators, examples, and the scenarios that should be implemented in TypeScript instead.

### 5. Declarative execution should remain constrained and governable

A low-code DSL becomes difficult to review if it grows arbitrary script, shell, network, or unrestricted navigation escape hatches. TestigentAI’s value is portability and deterministic governance, so the YAML runner intentionally excludes arbitrary JavaScript and shell execution.

Cross-origin navigation is blocked by default. Absolute HTTP(S) URLs are allowed only on the configured application origin unless `DECLARATIVE_ALLOW_EXTERNAL_NAVIGATION=true` is explicitly enabled after review. Application-relative paths are resolved against the configured **application root**, not merely the URL origin. This prevents the exact class of failure where a base URL such as `https://demo.playwright.dev/todomvc` combined with `url: /` accidentally navigates to `https://demo.playwright.dev/`.

**Decision:** safe-by-default navigation semantics are part of the DSL contract, and complex cross-origin workflows belong in TypeScript unless explicitly governed.

## Product design implemented in v1.2.0

### Authoring workflow

The intended user journey is:

```text
Need a simple UI scenario
        |
        v
npm run scenario:help
        |
        v
npm run scenario:new -- --app <app> --name "..." --url /
        |
        v
VS Code schema completion + hover + inline validation
        |
        v
npm run scenario:validate -- <file>
        |
        v
npm run scenario:run -- --app <app> --id <scenario-id>
        |
        v
Normal Playwright reporting / CI / sharding
```

A project can contain many scenario files. The dynamic declarative Playwright spec discovers them recursively and declares each scenario as an independent Playwright test. This preserves parallelism, retry isolation, sharding, reporting, and scenario-level ownership.

### Commands

| Command | Purpose |
| --- | --- |
| `npm run scenario:help` | Shows exactly what YAML can and cannot express. |
| `npm run scenario:list -- --app demo` | Lists discovered scenarios with IDs, tags, and files. |
| `npm run scenario:new -- --app demo --name "Create order" --url /orders` | Scaffolds a schema-linked YAML file. |
| `npm run scenario:validate -- <file>` | Validates YAML syntax and the DSL contract without opening a browser. |
| `npm run scenario:validate -- --app demo` | Validates all project scenarios and duplicate IDs. |
| `npm run scenario:run -- --app demo --id <id>` | Runs exactly one scenario through the normal governed Playwright wrapper. |
| `npm run scenario:schema` | Regenerates the committed IDE schema. |
| `npm run scenario:schema:check` | Fails if the committed schema is stale. |
| `npm run scenario:doctor -- --app demo` | Checks schema currency, capability drift, VS Code association, and all project scenarios. |

`scenario:doctor` is included in `validate:final`, so authoring drift is release-blocking.

### Supported YAML action set

v1.2.0 deliberately keeps the action set compact:

- Navigation: `goto`
- Interaction: `click`, `fill`, `check`, `uncheck`, `select`, `press`
- Assertions: `expectVisible`, `expectHidden`, `expectText`, `expectValue`

This covers the most common linear UI business flows without introducing a second general-purpose language.

### Supported locator set

- Preferred: `role`, `label`, `text`, `testId`
- Also supported: `placeholder`, `altText`, `title`
- Advanced fallback: `css`

The `role` strategy requires an allow-listed ARIA role and optionally an accessible name. Unknown keys are rejected, which catches spelling mistakes that permissive YAML would otherwise silently ignore.

## YAML vs TypeScript decision model

### Use YAML when all of these are true

1. The scenario is UI-only.
2. The flow is linear and deterministic.
3. Every interaction or assertion maps to a supported action.
4. The target elements can be expressed with supported locators.
5. No custom programming logic is required.
6. The scenario can safely execute inside the configured application boundary.

### Use TypeScript when any of these are true

- Conditions, loops, branching, or custom retry/business logic are required.
- UI, API, and database layers must be orchestrated in one test.
- The test needs custom authentication/token transformation.
- The flow needs popups, advanced multi-tab behavior, file upload/download, drag/drop, complex iframe or Shadow DOM behavior not yet explicitly supported.
- Network interception, mocks, WebSockets, or custom request handling are required.
- Data transformation or dynamic calculations require code.
- The scenario evaluates an LLM/agent, custom AI metric, or provider behavior.
- A scenario needs an escape hatch to arbitrary JavaScript or shell commands.

The last case is intentionally TypeScript: adding arbitrary code execution to YAML would defeat reviewability and governance.

## Reliability and CI implications

### Preflight before browser cost

Schema/runtime validation catches malformed actions, missing fields, bad IDs, malformed tags, duplicate scenario IDs, and unsupported locator shapes before a browser starts. This reduces expensive CI failures caused by authoring syntax mistakes.

### One scenario equals one test

Dynamic discovery turns each YAML file into one Playwright test with:

- `@scenario:<id>` selector
- `@declarative`, `@ui`, and `@lane:ui` classification
- scenario tags such as `@smoke`
- Playwright annotations for scenario ID and file
- step-level `test.step()` reporting

This keeps declarative tests compatible with TestigentAI’s existing workers, shards, retries, reports, and profile governance.

### Navigation semantics

Application-relative paths are resolved against the configured `uiBaseUrl` path. For example:

```text
configured uiBaseUrl: https://demo.playwright.dev/todomvc
YAML url: /
resolved: https://demo.playwright.dev/todomvc/

YAML url: /completed
resolved: https://demo.playwright.dev/todomvc/completed
```

If an older scenario explicitly says `/todomvc/`, the resolver recognizes that the path already contains the application root and does not duplicate it.

## What is intentionally not implemented yet

Deep research shows that commercial low-code platforms extend into variables, reusable modules, recorders, API steps, loops, conditional flow, multi-tab handling, AI authoring, and self-healing.[8][9][10] Adding all of those immediately would increase surface area and reduce determinism.

The next safe expansions should be evidence-driven:

1. **Variables and secret references** with strict redaction and no plaintext-secret persistence.
2. **Reusable declarative modules** with bounded parameters, not arbitrary code.
3. **Recorder/codegen-to-YAML conversion** that maps only supported Playwright actions and requires replay validation before save.
4. **Natural-language-to-YAML proposal generation** as a reviewed proposal, never as an unreviewed direct execution path.
5. **Additional explicit actions** only when real project demand justifies them; likely candidates include hover, file upload, popup, and frame scopes.
6. **Migration tooling** if schemaVersion 2 is introduced.

## Architecture judgment

The strongest differentiator for TestigentAI is not having the largest low-code action catalog. BrowserStack and enterprise suites already compete heavily on broad UI record/playback capabilities.[8][9] TestigentAI’s defensible angle is a **code-first quality engineering control plane with an optional, open, version-controlled, schema-driven low-code layer** that shares the same Playwright execution, governance, reporting, CI, and project model.

That architecture keeps YAML approachable for manual testers while preserving an honest boundary: when a scenario becomes software logic, it becomes TypeScript.

## Sources

1. JSON Schema. “Draft 2020-12.” Published June 16, 2022. https://json-schema.org/draft/2020-12
2. Red Hat. “YAML Language Server — Associating schemas.” https://github.com/redhat-developer/yaml-language-server
3. Red Hat. “YAML — Visual Studio Marketplace.” https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml
4. Zod. “JSON Schema.” Zod 4.5 documentation. https://zod.dev/json-schema
5. Zod. “Metadata and registries.” https://zod.dev/metadata
6. Microsoft Playwright. “Locators.” https://playwright.dev/docs/locators
7. Microsoft Playwright. “Test generator.” https://playwright.dev/docs/codegen
8. BrowserStack. “What is Low Code Automation?” https://www.browserstack.com/docs/low-code-automation/overview/introduction
9. BrowserStack. “Supported actions in the recorder.” https://www.browserstack.com/docs/low-code-automation/test-recording/record-actions
10. BrowserStack. “Agentic testing in Low Code Automation.” https://www.browserstack.com/docs/low-code-automation/test-recording/browserstack-ai/agentic-testing
11. Katalon. “Create and edit test steps in Manual view.” Updated August 2026. https://docs.katalon.com/katalon-studio/create-test-cases/generate-test-steps-in-katalon-studio-manual-view
12. Katalon. “Create and edit test scripts in Script view.” Updated August 2026. https://docs.katalon.com/katalon-studio/create-test-cases/generate-test-steps-in-katalon-studio-script-view
13. Tricentis. “Tosca Agentic Test Automation.” https://docs.tricentis.com/tosca-2026.1/en-us/content/agentic_ai/landing_page.htm
