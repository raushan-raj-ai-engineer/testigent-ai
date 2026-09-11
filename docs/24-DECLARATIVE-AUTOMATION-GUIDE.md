# Declarative Automation Guide

This guide is for manual testers, QA engineers, and developers who want to use TestigentAI’s governed YAML UI automation without guessing the supported syntax.

## Start here

Run:

```bash
npm run scenario:help
```

If the scenario is a simple, linear UI business flow, YAML is usually suitable. If it needs loops, branching, custom code, API/DB orchestration, advanced browser behavior, or AI evaluation, write a normal TypeScript Playwright test instead. Declarative YAML is optional per project: `scenario:doctor` validates the authoring capability and any scenarios that exist, but a project with zero YAML scenarios remains valid.

## Recommended workflow

```bash
npm run scenario:new -- --app demo --name "Create todo" --url /
npm run scenario:list -- --app demo
npm run scenario:validate -- projects/demo/data/scenarios/create-todo.yaml
npm run scenario:run -- --app demo --id create-todo
```

Before a PR or release:

```bash
npm run scenario:doctor -- --app demo
npm run validate:final
```

## Example

```yaml
# yaml-language-server: $schema=../../../../schemas/testigent-scenario.schema.json
schemaVersion: 1
kind: ui
id: login-valid-user
title: Valid user can sign in
tags:
  - "@smoke"
steps:
  - action: goto
    url: /login

  - action: fill
    by: label
    value: Email
    text: qa@example.com

  - action: fill
    by: label
    value: Password
    text: secret-from-safe-test-data

  - action: click
    by: role
    role: button
    name: Sign in

  - action: expectVisible
    by: text
    value: Welcome
```

Do not commit production credentials or secrets into YAML. Use the application’s governed auth/session mechanism or a safe project data strategy.

## Supported actions

| Action | Required fields beyond locator | Purpose |
| --- | --- | --- |
| `goto` | `url` | Navigate inside the configured application. |
| `click` | — | Click an element. |
| `fill` | `text` | Enter text into a control. |
| `check` | — | Check checkbox/radio. |
| `uncheck` | — | Uncheck checkbox. |
| `select` | `option` | Select native option. |
| `press` | `key` | Send keyboard key such as Enter or Tab. |
| `expectVisible` | — | Assert visible. |
| `expectHidden` | — | Assert hidden. |
| `expectText` | `text`, optional `match` | Assert text; `match` is `contains` or `exact`. |
| `expectValue` | `expected` | Assert a form value. |

## Locator strategies

Prefer in this order when appropriate:

1. `role` — best semantic choice for buttons, links, checkboxes, headings, etc.
2. `label` — preferred for labeled form fields.
3. `text` — useful for visible business text.
4. `testId` — explicit automation contract when UI wording is not stable.
5. `placeholder`, `altText`, `title` — supported situational locators.
6. `css` — advanced fallback; avoid when a semantic locator is available.

### Role locator

```yaml
- action: click
  by: role
  role: button
  name: Save
```

### Label locator

```yaml
- action: fill
  by: label
  value: Email
  text: qa@example.com
```

### Test ID locator

```yaml
- action: expectText
  by: testId
  value: order-status
  text: Approved
  match: exact
```

## Application-root navigation

Declarative `goto` treats slash paths as relative to the configured application root.

If configuration says:

```text
uiBaseUrl = https://demo.playwright.dev/todomvc
```

then:

```yaml
- action: goto
  url: /
```

opens:

```text
https://demo.playwright.dev/todomvc/
```

and:

```yaml
- action: goto
  url: /completed
```

opens:

```text
https://demo.playwright.dev/todomvc/completed
```

Cross-origin absolute navigation is blocked by default. Only enable `DECLARATIVE_ALLOW_EXTERNAL_NAVIGATION=true` after a deliberate security review.

## What should NOT be written in YAML

Use TypeScript for:

- if/else or complex conditions
- loops and custom retry logic
- UI + API + database validation in one test
- custom authentication/token flows
- advanced multi-tab/popups
- file upload/download until explicitly supported
- network mocks/intercepts
- custom calculations and data transformations
- WebSocket flows
- AI/LLM/agent evaluation
- arbitrary JavaScript or shell commands

The rule is simple: **YAML describes a bounded business flow; TypeScript implements software logic.**

## VS Code autocomplete

The repository contains:

```text
schemas/testigent-scenario.schema.json
.vscode/settings.json
.vscode/extensions.json
```

Install the recommended `redhat.vscode-yaml` extension. In scenario YAML files, `Ctrl+Space` shows valid actions/keys and invalid fields are highlighted before execution.

## Validation failures

Example invalid YAML:

```yaml
steps:
  - action: executeShell
    command: echo hello
```

Validation fails before browser execution and points the author to:

```bash
npm run scenario:help
```

Duplicate scenario IDs within the project are also rejected.

## Running only one scenario

```bash
npm run scenario:list -- --app demo
npm run scenario:run -- --app demo --id todo-low-code-001
```

Each scenario is declared as its own Playwright test and receives an `@scenario:<id>` tag, so it remains independently retryable, shardable, and reportable.

## Adding a new DSL capability

Do not add an action only in the runner. A product capability change must update:

1. `scenario.schema.ts` runtime contract
2. `scenario.capabilities.ts` help catalog
3. `scenario.runner.ts` implementation
4. `scenario.json-schema.ts` editor contract
5. contract tests
6. this guide if user-facing behavior changed

`scenario:doctor` and framework contract tests exist to catch drift.
