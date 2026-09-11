# V6 Quality Lanes & Governed Declarative Authoring

## Lanes

TestigentAI classifies capabilities independently from suite profile:

`ui | api | db | e2e | ai | visual | accessibility | performance`

Profiles answer **when/how broadly** to execute. Lanes answer **what capability** the test requires.

Examples:

```bash
APP=demo ENV=qa npm run test:api
APP=demo ENV=qa npm run test:db
APP=demo ENV=qa npm run test:accessibility
APP=demo ENV=qa npm run test:performance
```

UI/E2E/visual/browser accessibility/performance lanes may require browser auth when project policy says so. API/DB-only lanes are not blocked by a missing browser storage-state file.

## Declarative authoring

The scenario DSL is an intentionally small, allowlisted surface. JSON/YAML scenarios can express navigation, click/fill/check/select and focused expectations. They cannot execute shell commands or arbitrary JavaScript.

This gives non-developers a lower-code entry point without turning YAML into an ungoverned remote-code-execution surface.

## AI/manual/generated governance

`custom` is safe-deny for AI-generated, generated-review and manual-only execution unless the caller explicitly enables those categories. AI-generated tests remain reviewable source artifacts before promotion.

## Accessibility

The built-in accessibility helper is a **smoke detector**, not a WCAG conformance engine. It catches inexpensive DOM issues in PR feedback. Full accessibility programs should plug in a specialist rules engine and include assistive-technology/manual validation.

## Visual

The framework wraps Playwright screenshot assertions today. Keep visual intent in project tests while allowing an organization to replace/augment the underlying engine with Percy, Applitools, SmartUI or another approved provider.

## Performance

The built-in budget helper measures browser navigation/resource timing for functional regression budgets. Load/performance engineering should integrate k6, JMeter, Gatling or an approved managed platform and correlate their evidence into the run.
