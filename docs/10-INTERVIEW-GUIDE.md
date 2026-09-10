# Interview Guide

## Two-minute architecture answer

“I designed the framework as a reusable quality platform rather than a single-application test suite. Generic capabilities—configuration, fixtures, API transport, database clients, data readers, reporting, logging, healing, AI policy and requirement intelligence—live under `src/framework`. Each application owns its pages, workflows, API domain services, database repositories, data, requirements, fixtures and tests under `projects/<project>`.

A project is selected through APP and ENV. The registry loads that project’s environment configuration, while a generic runner performs preflight checks and automatically wires the configured authentication state. Project fixtures extend the reusable fixture, so teams share infrastructure without importing each other’s application code.

For quality gates I separate framework validation from product validation. The framework has architecture checks, TypeScript checks and deterministic framework regressions. Product defects remain product failures; known defects are explicitly registered and use expected-failure semantics so they are visible and produce an unexpected-pass signal when fixed. Reporting is project-scoped and CI shards technical/business results before producing one merged stakeholder dashboard and optional notification.

AI and self-healing are guarded enhancements, not the foundation. Deterministic locators, assertions, policies and permissions remain the default, while AI/MCP assist exploration and authoring under review and security controls.”

## Senior design points

Be ready to explain why core cannot import projects, why workflows are separate from pages, why SQL/endpoints belong to projects, how auth differs for mutating parallel tests, why healing suggestion mode is safer than silent mutation, how known-defect expected failures differ from skipping, and why CI merges reports before stakeholder notification.
