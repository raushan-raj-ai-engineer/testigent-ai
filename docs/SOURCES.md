# Research Sources

The architecture and operational recommendations were checked against current first-party guidance on 10 September 2026.

1. Playwright, “Fixtures.” https://playwright.dev/docs/test-fixtures — fixtures provide isolated, composable test environments. Used to justify a reusable framework fixture extended by project-specific fixtures.
2. Playwright, “Authentication.” https://playwright.dev/docs/auth — authenticated browser state can be reused; auth state should be excluded from source control; separate/per-worker strategies are appropriate when tests mutate shared server-side state.
3. Playwright, “Projects.” https://playwright.dev/docs/test-projects — Playwright projects group tests under shared configuration and support project dependencies. Used for browser/config variants, not as a substitute for repository-level application ownership boundaries.
4. Playwright, “Reporters.” https://playwright.dev/docs/test-reporters — blob reports support merging distributed/sharded runs.
5. Playwright, “Continuous Integration.” https://playwright.dev/docs/ci — CI installation and browser guidance; shard independent tests and publish artifacts after execution.
6. Playwright, “Release Notes.” https://playwright.dev/docs/release-notes — current Playwright 1.63 capabilities include test locks for genuinely shared resources while allowing unrelated tests to remain parallel.
7. Microsoft Learn, “Secrets in pipelines.” https://learn.microsoft.com/en-us/azure/devops/pipelines/security/secrets?view=azure-devops — do not store secrets as plaintext YAML; use secret variables, variable groups or Key Vault; avoid echoing/passing secrets on command lines.
8. Microsoft Learn, “Use Azure Key Vault secrets in Azure Pipelines.” https://learn.microsoft.com/en-us/azure/devops/pipelines/release/azure-key-vault?view=azure-devops — guidance for mapping Key Vault-managed secrets into pipelines.
9. GitHub Docs, “Secrets.” https://docs.github.com/en/actions/concepts/security/secrets — repository/organization/environment secrets and explicit workflow access.
10. SheetJS, “Security.” https://docs.sheetjs.com/docs/miscellany/security/ — upstream security/version notes for SheetJS. This repository vendors `xlsx-0.20.3.tgz`; `security:check` only allows the known `xlsx@0.20.3` scanner finding and blocks any other HIGH/CRITICAL finding.

11. Google AI for Developers, “Gemini API.” https://ai.google.dev/gemini-api/docs — current guidance identifies the Interactions API as the recommended Gemini interface for new integrations.
12. Google AI for Developers, “Interactions API.” https://ai.google.dev/api/interactions-api — current REST endpoint and response structure used by `GeminiAiProvider`.
13. Google AI for Developers, “Models.” https://ai.google.dev/api/models — `models.get` is used by the Gemini health check to verify that the configured API key can access the configured model without running a generation request.
14. Google AI for Developers, “Structured outputs.” https://ai.google.dev/gemini-api/docs/structured-output — response-format schema guidance used for guarded locator JSON output.

- Playwright Test Agents: https://playwright.dev/docs/test-agents
- GitHub custom agents: https://docs.github.com/en/copilot/concepts/agents/copilot-cli/about-custom-agents
- GitHub custom agent configuration: https://docs.github.com/en/copilot/reference/custom-agents-configuration

## V6 market / product research (2026)

- Capgemini, World Quality Report 2025-26: https://www.capgemini.com/insights/research-library/world-quality-report-2025-26/
- PractiTest, 2026 State of Testing: https://www.practitest.com/state-of-testing/
- Playwright documentation (parallelism, sharding, agents): https://playwright.dev/docs/test-parallel ; https://playwright.dev/docs/test-sharding ; https://playwright.dev/docs/test-agents
- BrowserStack AI Agents / Test Management: https://www.browserstack.com/automate/ai-agents ; https://www.browserstack.com/test-management
- TestMu AI KaneAI: https://www.testmuai.com/kane-ai/
- Tricentis Vision AI: https://docs.tricentis.com/tosca-2026.1/en-us/content/vision_ai/vision_ai_introduction.htm
- Katalon MCP: https://docs.katalon.com/katalon-platform/testops-mcp-server
- mabl AI application testing: https://www.mabl.com/ai-application-testing
- Postman Agent Mode: https://learning.postman.com/docs/use/agent-mode/overview
- DeepEval AI agent evaluation: https://deepeval.com/guides/guides-ai-agent-evaluation-metrics
- LangSmith evaluation concepts: https://docs.langchain.com/langsmith/evaluation-concepts

## 2026 market validation additions
- Capgemini, World Quality Report 2025-26: https://www.capgemini.com/insights/research-library/world-quality-report-2025-26/
- BrowserStack AI Test Management agents: https://www.browserstack.com/docs/test-management/browserstack-ai
- BrowserStack test data generator agent: https://www.browserstack.com/docs/test-management/browserstack-ai/generate-test-datasets
- BrowserStack Playwright AI self-heal: https://www.browserstack.com/docs/automate/playwright/self-healing
- Tricentis Tosca Cloud release notes: https://docs.tricentis.com/tosca-cloud/en-us/content/release_notes/release_notes.htm
- Tricentis Tosca Agentic Test Automation: https://docs.tricentis.com/tosca-2026.1/en-us/content/agentic_ai/landing_page.htm
- Katalon TrueTest / Production Insights: https://katalon.com/truetest
- DeepEval AI Agent Evaluation Metrics: https://deepeval.com/guides/guides-ai-agent-evaluation-metrics
- LangSmith Evaluation: https://docs.langchain.com/langsmith/evaluation
- LangSmith trajectory evaluation: https://docs.langchain.com/langsmith/trajectory-evals
