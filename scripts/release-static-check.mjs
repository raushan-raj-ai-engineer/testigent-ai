import fs from 'node:fs';
import path from 'node:path';
import { hasInformationalBusinessSummaryContract, normalizeContractText } from './lib/release-text-contracts.mjs';

const root = process.cwd();
const issues = [];
const ignored = new Set(['node_modules', '.git', 'reports', 'test-results']);

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full)); else out.push(full);
  }
  return out;
}

for (const obsolete of ['src/applications', 'requirements', 'test-data', 'generated', 'specs', 'PATCH-README.md', 'tsconfig.json.bak', '.upgrade-backup']) {
  if (fs.existsSync(path.join(root, obsolete))) issues.push(`obsolete release path: ${obsolete}`);
}

for (const file of walk(path.join(root, 'src', 'framework')).filter(f => f.endsWith('.ts'))) {
  const text = fs.readFileSync(file, 'utf8');
  if (/from\s+['"][^'"]*projects\//.test(text)) issues.push(`framework imports project: ${path.relative(root, file)}`);
}

for (const file of walk(root).filter(f => /\.(?:ts|tsx|js|mjs|cjs)$/.test(f))) {
  if (path.basename(file) === 'release-static-check.mjs') continue;
  const text = fs.readFileSync(file, 'utf8');
  const legacyReporting = 'src/' + 'reporting/';
  if (text.includes(legacyReporting)) issues.push(`legacy reporting path reference: ${path.relative(root, file)}`);
  if (/\.(?:ts|tsx)$/.test(file) && text.includes('import.meta')) issues.push(`CommonJS-incompatible import.meta usage: ${path.relative(root, file)}`);
}

for (const project of fs.readdirSync(path.join(root, 'projects'), { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name)) {
  for (const needed of [`projects/${project}/project.json`, `projects/${project}/config`, `projects/${project}/fixtures/test.fixture.ts`, `projects/${project}/src/app.facade.ts`, `projects/${project}/tests/_agent/seed.spec.ts`, `projects/${project}/tests`]) {
    if (!fs.existsSync(path.join(root, needed))) issues.push(`project contract missing: ${needed}`);
  }

  const projectJsonPath = path.join(root, `projects/${project}/project.json`);
  if (fs.existsSync(projectJsonPath)) {
    try {
      const projectJson = JSON.parse(fs.readFileSync(projectJsonPath, 'utf8'));
      if (typeof projectJson.capabilities?.database?.required !== 'boolean') {
        issues.push(`project database capability policy missing: projects/${project}/project.json`);
      }
    } catch (error) {
      issues.push(`unable to validate project capability policy for ${project}: ${error.message}`);
    }
  }
  const environmentFiles = fs.existsSync(path.join(root, `projects/${project}/config`))
    ? fs.readdirSync(path.join(root, `projects/${project}/config`)).filter(file => file.endsWith('.json'))
    : [];
  for (const environmentFile of environmentFiles) {
    try {
      const environmentJson = JSON.parse(fs.readFileSync(path.join(root, `projects/${project}/config`, environmentFile), 'utf8'));
      if (!['none', 'postgres', 'mysql', 'mssql'].includes(environmentJson.capabilities?.database?.type)) {
        issues.push(`project database type missing/invalid: projects/${project}/config/${environmentFile}`);
      }
      if (environmentJson.auth?.strategy === 'storageState' && environmentJson.auth?.required !== false) {
        const verification = environmentJson.auth?.verification;
        if (!verification || (!verification.stateKey && !verification.unauthenticatedControl && !verification.authenticatedControl && !verification.unauthenticatedUrlPattern && !verification.authenticatedUrlPattern)) {
          issues.push(`required storageState auth verification missing: projects/${project}/config/${environmentFile}`);
        }
        const lifecycle = environmentJson.auth?.lifecycle;
        if (lifecycle?.autoRefresh === true) {
          const providerModule = String(lifecycle.providerModule ?? '').trim();
          if (!providerModule) {
            issues.push(`auto-refresh auth provider missing: projects/${project}/config/${environmentFile}`);
          } else {
            const providerPath = providerModule.startsWith('projects/')
              ? path.join(root, providerModule)
              : path.join(root, 'projects', project, providerModule);
            if (!fs.existsSync(providerPath)) issues.push(`auto-refresh auth provider file missing: ${path.relative(root, providerPath)}`);
          }
          for (const key of ['refreshSkewMs', 'maxRefreshAttempts', 'maxRuntimeRefreshes', 'lockTimeoutMs', 'lockStaleMs']) {
            if (lifecycle[key] !== undefined && (!Number.isInteger(lifecycle[key]) || lifecycle[key] <= 0)) {
              issues.push(`invalid auth.lifecycle.${key}: projects/${project}/config/${environmentFile}`);
            }
          }
        }
      }
    } catch (error) {
      issues.push(`unable to validate project environment capability for ${project}/${environmentFile}: ${error.message}`);
    }
  }
}


// Provider-neutral AI release contracts.
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const genericAiScript = pkg.scripts?.['test:ai-healing'] ?? '';
  if (/AI_PROVIDER=/.test(genericAiScript)) issues.push('generic test:ai-healing must not hardcode an AI provider');
  if (!pkg.scripts?.['test:ai-healing:ollama']) issues.push('missing explicit Ollama AI-healing example script');
  if (!pkg.scripts?.['test:ai-healing:gemini']) issues.push('missing explicit Gemini AI-healing example script');
} catch (error) {
  issues.push(`unable to validate package AI scripts: ${error.message}`);
}


try {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  for (const [group, entries] of Object.entries({ dependencies: pkg.dependencies ?? {}, devDependencies: pkg.devDependencies ?? {} })) {
    for (const [name, spec] of Object.entries(entries)) {
      if (String(spec) === 'latest' || /^[~^]/.test(String(spec))) issues.push(`floating dependency not allowed in release: ${group}.${name}=${spec}`);
    }
  }
} catch (error) {
  issues.push(`unable to validate dependency pinning: ${error.message}`);
}


for (const required of [
  'config/architecture.json',
  'docs/14-ROOT-FOLDERS-AND-LOCAL-STATE.md',
  'docs/15-NEW-PROJECT-HANDOFF.md',
  'docs/16-PLAYWRIGHT-AGENTS-PRODUCTIVITY.md',
  'docs/17-DEEP-REVIEW-2026.md',
  'docs/25-AUTHORING-ARCHITECTURE-REFACTOR.md',
  'src/framework/core/config/workspace.context.ts',
  'src/framework/core/config/application.scope.ts',
  'src/framework/core/config/runtime.config.ts',
  'src/framework/core/config/capability.policy.ts',
  'src/framework/core/auth.state.ts',
  'src/framework/core/auth.verifier.ts',
  'src/framework/core/auth.manager.ts',
  'src/framework/core/auth.provider.ts',
  'src/framework/core/auth.lock.ts',
  'scripts/auth-prepare.ts',
  'scripts/ci-report-bundle.ts',
  'tests/framework/auth-lifecycle.spec.ts',
  'tests/framework/sdet-auth-provider.contract.spec.ts',
  'docs/28-AUTH-LIFECYCLE-AUTO-REFRESH.md',
  'docs/29-AGENT-AUTHORING-UI-API-DB-E2E.md',
  'docs/30-RECOVERY-ARCHITECTURE.md',
  'docs/31-ARCHITECT-REVIEW-CLOSURE-v1.5.0.md',
  'docs/32-PILOT-ADOPTION-AND-METRICS.md',
  'docs/33-RELEASE-COMPATIBILITY-MATRIX.md',
  'docs/34-v1.5.0-VALIDATION-EVIDENCE.md',
  'docs/38-v1.5.2-CI-RERUN-ARTIFACT-PROVENANCE.md',
  'docs/39-v1.5.3-WINDOWS-STATIC-GATE-PORTABILITY.md',
  '.github/workflows/release-compatibility.yml',
  'scripts/release-compatibility-probe.mjs',
  'scripts/release-static-portability-contract.mjs',
  'scripts/lib/release-text-contracts.mjs',
  'config/security-exceptions.json',
  'src/framework/ai/ai-egress.policy.ts',
  'src/framework/logging/evidence.policy.ts',
  'src/framework/logging/evidence.retention.ts',
  'src/framework/security/advisory.policy.ts',
  'tests/framework/review-hardening-contract.spec.ts',
  'tests/framework/browser-free-fixtures.spec.ts',
  'scripts/migration-assess.ts',
  'src/framework/reporting/portfolio-dashboard.writer.ts',
  'tests/framework/portfolio-reporting.spec.ts',
  'scripts/qa.ts',
  'scripts/healing-maintenance.ts',
  'templates/project/src/app.facade.ts',
  'templates/project/tests/_agent/seed.spec.ts',
  'scripts/harden-agent-definitions.ts',
  'scripts/authoring-productivity.ts',
  'src/framework/ai/ai.audit.ts',
  'src/framework/core/execution/execution.policy.ts',
  'src/framework/core/execution/execution.cli-filters.ts',
  'src/framework/data/data-scope.ts',
  'src/framework/execution/duration-history.store.ts',
  'src/framework/evaluation/evaluation.runner.ts',
  'src/framework/declarative/scenario.runner.ts',
  'src/framework/declarative/scenario.schema.ts',
  'src/framework/declarative/scenario.json-schema.ts',
  'src/framework/declarative/scenario.capabilities.ts',
  'schemas/testigent-scenario.schema.json',
  'scripts/scenario-authoring.ts',
  'docs/23-DECLARATIVE-AUTHORING-DEEP-RESEARCH.md',
  'docs/24-DECLARATIVE-AUTOMATION-GUIDE.md',
  'docs/19-MARKET-COMPETITIVE-RESEARCH-2026.md',
  'docs/20-V6-DATA-PARALLEL-EXECUTION.md',
  'docs/21-QUALITY-LANES-AND-DECLARATIVE-AUTHORING.md',
  'docs/22-COMPETITIVE-BENCHMARK-PLAN.md',
  'scripts/offline-release-check.mjs',
  'scripts/generate-sbom.mjs',
  'scripts/generate-release-manifest.mjs',
  'VERIFY_RELEASE.sh',
  'APPLY_UPGRADE.sh',
  'VERIFY_UPGRADE.sh'
]) {
  if (!fs.existsSync(path.join(root, required))) issues.push(`required deep-review artifact missing: ${required}`);
}

try {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  if (!pkg.scripts?.['agents:init']) issues.push('missing generic agents:init script');
  if (!pkg.scripts?.['agents:policy']) issues.push('missing agent enterprise-policy script');
  if (!pkg.scripts?.['authoring:report']) issues.push('missing authoring productivity report script');
  if (!pkg.scripts?.['comments:audit']?.includes('docs:comment-audit')) issues.push('comments:audit must alias docs:comment-audit for CLI compatibility');
  if (!pkg.scripts?.['release:static']?.includes('release-static-portability-contract.mjs')) issues.push('release:static must execute the LF/CRLF portability regression contract');
  for (const scenarioScript of ['scenario:help', 'scenario:list', 'scenario:validate', 'scenario:new', 'scenario:run', 'scenario:doctor', 'scenario:schema', 'scenario:schema:check']) {
    if (!pkg.scripts?.[scenarioScript]) issues.push(`missing declarative authoring script: ${scenarioScript}`);
  }
  const finalValidationContract = `${pkg.scripts?.['validate:final'] ?? ''} ${pkg.scripts?.['validate:final:steps'] ?? ''}`;
  if (!finalValidationContract.includes('scenario:doctor')) issues.push('validate:final must enforce scenario:doctor');
  if (!pkg.scripts?.['mcp:start']?.includes('start-mcp.ts')) issues.push('mcp:start must use env-driven start-mcp.ts wrapper');
  if (pkg.engines?.node !== '>=22 <23' || fs.readFileSync(path.join(root, '.nvmrc'), 'utf8').trim() !== '22') issues.push('release runtime must be consistently pinned to Node 22 in package engines and .nvmrc');
  const copilotSetup = fs.readFileSync(path.join(root, '.github/workflows/copilot-setup-steps.yml'), 'utf8');
  if (!copilotSetup.includes("node-version-file: '.nvmrc'")) issues.push('Copilot setup workflow must use the same .nvmrc release runtime');
  const compatibilityWorkflow = fs.readFileSync(path.join(root, '.github/workflows/release-compatibility.yml'), 'utf8');
  if (!compatibilityWorkflow.includes("- 'v*'")) issues.push('release compatibility workflow must run automatically for version tags as well as manual dispatch');
} catch (error) {
  issues.push(`unable to validate deep-review scripts: ${error.message}`);
}

const githubAgents = path.join(root, '.github', 'agents');
if (fs.existsSync(githubAgents)) {
  for (const file of walk(githubAgents).filter(f => f.endsWith('.md'))) {
    const text = fs.readFileSync(file, 'utf8');
    if (/^model:\s*.+$/m.test(text)) issues.push(`repository agent pins a model instead of user/client choice: ${path.relative(root, file)}`);
    if (!text.includes('TESTIGENTAI ENTERPRISE QUALITY OVERLAY V2')) issues.push(`repository agent missing enterprise overlay V2: ${path.relative(root, file)}`);
  }
}

const envExamplePath = path.join(root, '.env.example');
if (fs.existsSync(envExamplePath)) {
  const envExample = fs.readFileSync(envExamplePath, 'utf8');
  if (/^AI_PROVIDER=(?!\s*$).+/m.test(envExample)) issues.push('.env.example must not impose a default AI provider');
  if (!/^AI_PROVIDER_MODE=single$/m.test(envExample)) issues.push('.env.example must document single as the safe provider-selection mode');
  if (!/^APP=\s*$/m.test(envExample) || !/^ENV=\s*$/m.test(envExample)) issues.push('.env.example must not impose a default project/environment');
  if (/^DB_TYPE=/m.test(envExample)) issues.push('.env.example must not expose DB_TYPE as a shared override; project/environment config exclusively owns database type');
}



// CI merge topology contracts: core shard completeness and AI lane completeness are independent.
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  if (!pkg.scripts?.['ci:report:bundle']?.includes('ci-report-bundle.ts')) issues.push('missing ci:report:bundle topology marker script');
  const githubWorkflow = normalizeContractText(fs.readFileSync(path.join(root, '.github/workflows/playwright-sharded.yml'), 'utf8'));
  if (!githubWorkflow.includes('EXPECTED_CORE_WORKERS')) issues.push('GitHub merge must enforce core worker topology independently');
  if (!githubWorkflow.includes('EXPECT_AI_LANE')) issues.push('GitHub merge must validate the optional AI lane independently');
  if (!githubWorkflow.includes('ci:report:bundle -- core') || !githubWorkflow.includes('ci:report:bundle -- ai')) issues.push('GitHub CI must publish core/AI bundle topology markers');
  if (!githubWorkflow.includes('CI_SHARDS') || !githubWorkflow.includes('inputs.shards')) issues.push('GitHub CI must support configurable sequential/sharded execution');
  if (!githubWorkflow.includes('business-${{ env.APP }}-${{ env.RUN_ID }}-core-${{ matrix.index }}') ||
      !githubWorkflow.includes('business-${{ env.APP }}-${{ env.RUN_ID }}-ai') ||
      !githubWorkflow.includes('pattern: business-${{ env.APP }}-${{ env.RUN_ID }}-*')) {
    issues.push('GitHub business artifacts must be scoped by immutable RUN_ID/run attempt so reruns cannot mix artifact generations');
  }
  if (!githubWorkflow.includes('blob-${{ env.APP }}-${{ env.RUN_ID }}-core-${{ matrix.index }}') ||
      !githubWorkflow.includes('pattern: blob-${{ env.APP }}-${{ env.RUN_ID }}-*')) {
    issues.push('GitHub technical artifacts must be scoped by immutable RUN_ID/run attempt');
  }
  if (!githubWorkflow.includes("EXPECT_AI_LANE: ${{ needs.ai-smoke.result == 'success' && 'true' || 'false' }}")) {
    issues.push('GitHub merge must expect the AI lane only when the AI job succeeded');
  }
  if (!githubWorkflow.includes('Validate downloaded report bundles')) issues.push('GitHub merge must validate downloaded current-attempt bundle markers before report merge');
  if (!githubWorkflow.includes("steps.merge-business.outcome == 'success'") || !githubWorkflow.includes("steps.validate-final-business.outcome == 'success'")) {
    issues.push('GitHub CI must preserve intermediate artifacts when report merge/final validation fails');
  }
  if (githubWorkflow.includes('actions/cache@v4')) issues.push('GitHub CI must not use the deprecated Node 20 actions/cache@v4 runtime');
  if (!githubWorkflow.includes('actions/cache@v6')) issues.push('GitHub report-history cache must use the supported Node 24 actions/cache@v6 runtime');
  if (githubWorkflow.includes("EXPECTED_BUSINESS_REPORTS: '2'")) issues.push('GitHub merge must not hardcode two business reports');
  const azureWorkflow = normalizeContractText(fs.readFileSync(path.join(root, 'azure-pipelines.yml'), 'utf8'));
  if (!azureWorkflow.includes('EXPECTED_CORE_WORKERS=') || !azureWorkflow.includes('EXPECT_AI_LANE=')) issues.push('Azure merge must independently validate core workers and AI lane');
  if (!azureWorkflow.includes('SHARD_TOTAL > 1')) issues.push('Azure CI must omit Playwright --shard for sequential single-worker execution');
} catch (error) {
  issues.push(`unable to validate CI report topology contracts: ${error.message}`);
}

// Semantic-healing release contracts (v1.2.2+).
try {
  const orchestrator = fs.readFileSync(path.join(root, 'src/framework/healing/healing.orchestrator.ts'), 'utf8');
  const cache = fs.readFileSync(path.join(root, 'src/framework/healing/healing.cache.ts'), 'utf8');
  const reportTypes = fs.readFileSync(path.join(root, 'src/framework/analytics/report.types.ts'), 'utf8');
  const businessReporter = fs.readFileSync(path.join(root, 'src/framework/reporting/business.reporter.ts'), 'utf8');
  const businessRenderer = fs.readFileSync(path.join(root, 'src/framework/reporting/business-html.renderer.ts'), 'utf8');
  if (!orchestrator.includes('SELF_HEALING_POSTCONDITION_REJECTED')) issues.push('semantic healing rejection contract missing');
  const enterpriseFixture = fs.readFileSync(path.join(root, 'src/framework/core/fixtures/enterprise.fixture.ts'), 'utf8');
  if (!orchestrator.includes('private aiGateway()') || !enterpriseFixture.includes('() => createAiGateway(testInfo.testId)')) issues.push('AI healing gateway must be lazy and created only after deterministic recovery is exhausted');
  if (!orchestrator.includes('.visible()')) issues.push('healing resolver must evaluate visible locator matches');
  if (!orchestrator.includes("descriptor.match === 'firstVisible'")) issues.push('explicit firstVisible locator cardinality policy missing');
  if (!orchestrator.includes("decision.source === 'fallback' || mode === 'runtime'")) issues.push('reviewed deterministic fallbacks must remain executable in suggest mode');
  if (!orchestrator.includes('LOCATOR_RESOLUTION_FAILED')) issues.push('locator failure diagnostics contract missing');
  const locatorResolver = fs.readFileSync(path.join(root, 'src/framework/healing/locator.resolver.ts'), 'utf8');
  if (!locatorResolver.includes('descriptor.namePattern')) issues.push('semantic accessible-name pattern support missing');
  if (!orchestrator.includes("'validated'")) issues.push('semantic healing validated outcome missing');
  if (!cache.includes("validation !== 'semantic'")) issues.push('healing cache must reject legacy/unverified cache entries');
  if (!cache.includes("validation: 'semantic'")) issues.push('healing cache must mark promoted entries as semantically validated');
  if (!reportTypes.includes('outcome?: HealingOutcome') || !reportTypes.includes('attempts: HealingAuditRecord[]')) issues.push('reporting healing outcome contract missing');
  if (!businessReporter.includes("outcome(record) === 'validated'")) issues.push('business reporting must count only validated healing as successful recovery');
  const businessOutcome = fs.readFileSync(path.join(root, 'src/framework/analytics/business-outcome.ts'), 'utf8');
  if (!businessRenderer.includes('payload.healing.records.filter') || !businessOutcome.includes("return 'PASSED_WITH_HEALING'")) issues.push('business report must derive healed status from validated healing records only');
} catch (error) {
  issues.push(`unable to validate semantic healing contracts: ${error.message}`);
}


// Business-standard reporting contracts (v1.2.6+).
try {
  const reportTypes = fs.readFileSync(path.join(root, 'src/framework/analytics/report.types.ts'), 'utf8');
  const businessOutcome = fs.readFileSync(path.join(root, 'src/framework/analytics/business-outcome.ts'), 'utf8');
  const executionFacts = fs.readFileSync(path.join(root, 'src/framework/analytics/execution-facts.ts'), 'utf8');
  const businessReporter = fs.readFileSync(path.join(root, 'src/framework/reporting/business.reporter.ts'), 'utf8');
  const businessRenderer = fs.readFileSync(path.join(root, 'src/framework/reporting/business-html.renderer.ts'), 'utf8');
  const csvWriter = fs.readFileSync(path.join(root, 'src/framework/reporting/business-dashboard.writer.ts'), 'utf8');
  const emailTemplate = fs.readFileSync(path.join(root, 'src/framework/notifications/business-email.template.ts'), 'utf8');
  const staticEmailReport = fs.readFileSync(path.join(root, 'src/framework/notifications/business-email-static-report.ts'), 'utf8');
  const knownDefects = fs.readFileSync(path.join(root, 'src/framework/core/known-defects.ts'), 'utf8');
  if (!reportTypes.includes("'KNOWN_DEFECT'") || !reportTypes.includes("'UNEXPECTED_PASS'")) issues.push('business outcome model must expose known defect and unexpected pass');
  if (!reportTypes.includes('PASSED_WITH_ACCEPTED_RISK')) issues.push('quality gate must support accepted-risk decision state');
  if (!businessOutcome.includes("outcome === 'KNOWN_DEFECT'") || !businessOutcome.includes('ciBlockingIssues')) issues.push('known-defect quality-vs-CI classification missing');
  if (!executionFacts.includes('qualityFailed') || !executionFacts.includes('qualityPassRate') || !executionFacts.includes('unexpectedFailed')) issues.push('business quality fact model missing');
  if (!knownDefects.includes("type: 'known-defect'") || !businessReporter.includes('readKnownDefect')) issues.push('known defects must be explicitly annotated and captured by reporter');
  if (!businessReporter.includes('printsToStdio(): boolean { return true; }') || !businessReporter.includes('Runner note: Playwright may count expected-failure known defects')) issues.push('business reporter missing stakeholder terminal visibility for expected known defects');
  if (!businessRenderer.includes('Known defects &amp; accepted risk') || !businessRenderer.includes('CI-blocking issues') || !businessRenderer.includes('Slowest scenarios')) issues.push('business dashboard missing executive risk/triage views');
  if (!csvWriter.includes('Business Outcome') || !csvWriter.includes('Known Defect ID')) issues.push('CSV export missing business-outcome/known-defect columns');
  if (!emailTemplate.includes('Quality failed') || !staticEmailReport.includes('Known defects')) issues.push('email/static reporting must use business-standard quality semantics');
} catch (error) {
  issues.push(`unable to validate business-standard reporting contracts: ${error.message}`);
}




// Reporting merge, applicability and evidence contracts (v1.2.8+).
try {
  const reportTypes = fs.readFileSync(path.join(root, 'src/framework/analytics/report.types.ts'), 'utf8');
  const executionFacts = fs.readFileSync(path.join(root, 'src/framework/analytics/execution-facts.ts'), 'utf8');
  const skipClassifier = fs.readFileSync(path.join(root, 'src/framework/reporting/skip-reason.classifier.ts'), 'utf8');
  const fixture = fs.readFileSync(path.join(root, 'src/framework/core/fixtures/enterprise.fixture.ts'), 'utf8');
  const renderer = fs.readFileSync(path.join(root, 'src/framework/reporting/business-html.renderer.ts'), 'utf8');
  const writer = fs.readFileSync(path.join(root, 'src/framework/reporting/business-dashboard.writer.ts'), 'utf8');
  const merge = fs.readFileSync(path.join(root, 'scripts/merge-business-reports.ts'), 'utf8');
  const mergeContract = fs.readFileSync(path.join(root, 'scripts/reporting-merge-contract.ts'), 'utf8');
  const bundleValidator = fs.readFileSync(path.join(root, 'scripts/validate-ci-business-bundle.ts'), 'utf8');
  const githubWorkflow = normalizeContractText(fs.readFileSync(path.join(root, '.github/workflows/playwright-sharded.yml'), 'utf8'));
  const azurePipeline = normalizeContractText(fs.readFileSync(path.join(root, 'azure-pipelines.yml'), 'utf8'));
  const sdetAuthProvider = fs.readFileSync(path.join(root, 'projects/sdet-practice/auth/auth.provider.ts'), 'utf8');
  if (!reportTypes.includes('executionEligible') || !reportTypes.includes('notApplicable') || !reportTypes.includes('blockedSkipped')) issues.push('reporting applicability/execution fact contract missing');
  if (!skipClassifier.includes("'NOT_APPLICABLE'") || !skipClassifier.includes("'BLOCKED'")) issues.push('skip disposition contract missing');
  if (!executionFacts.includes('total - notApplicable') || !executionFacts.includes("item.status !== 'skipped'")) issues.push('execution coverage/layer facts must exclude not-applicable/skipped scenarios correctly');
  if (!fixture.includes("testInfo.attach('failure-screenshot'") || !fixture.includes('testigent-failure.png')) issues.push('failed UI evidence screenshot fixture contract missing');
  if (!renderer.includes('Failure evidence') || !renderer.includes('<img') || !renderer.includes('Not Applicable')) issues.push('business dashboard inline evidence/applicability visibility missing');
  if (!renderer.includes('Additional attachments') || !renderer.includes('selectPrimaryFailureEvidence')) issues.push('business dashboard failure-evidence de-duplication contract missing');
  if (!writer.includes("failedScenario") || !writer.includes("contentType.startsWith('video/')")) issues.push('failed-scenario evidence materialization contract missing');
  if (!merge.includes('Duplicate business scenario across CI report bundles') || !merge.includes("mode: 'merged'")) issues.push('merged CI business report duplicate/aggregation guard missing');
  if (!mergeContract.includes('duplicate test IDs') || !mergeContract.includes('AI usage must merge exactly once')) issues.push('executable merged-report contract missing');
  if (!/failed UI/i.test(bundleValidator) || !bundleValidator.includes("contentType.startsWith('image/')")) issues.push('CI business bundle must require screenshot evidence for failed UI scenarios');
  if (!githubWorkflow.includes('--grep-invert="@ai"') || !azurePipeline.includes('--grep-invert="@ai"')) issues.push('normal CI shards must exclude dedicated AI tests');
  if (!githubWorkflow.includes('npm run --silent ci:business:summary >> "$GITHUB_STEP_SUMMARY"')) issues.push('GitHub merged-report summary must use the dedicated summary script');
  if (!hasInformationalBusinessSummaryContract(githubWorkflow)) issues.push('GitHub merged-report summary must remain informational/non-blocking');
  if (githubWorkflow.includes("<<'NODE'") || githubWorkflow.includes('GITHUB\\_STEP\\_SUMMARY')) issues.push('GitHub merged-report summary must not use fragile heredoc/escaped step-summary syntax');
  if (!merge.includes('EXPECTED_CORE_WORKERS') || !merge.includes('EXPECT_AI_LANE') || !githubWorkflow.includes('EXPECTED_CORE_WORKERS:') || !githubWorkflow.includes('EXPECT_AI_LANE:') || !azurePipeline.includes('EXPECTED_CORE_WORKERS="${{ parameters.shards }}"') || !azurePipeline.includes('EXPECT_AI_LANE="${{ parameters.runAi }}"')) issues.push('CI merged-report core-worker/AI topology guard missing');
  if (!githubWorkflow.includes('--pass-with-no-tests') || !azurePipeline.includes('--pass-with-no-tests') || !githubWorkflow.includes('ci:report:bundle -- core ${{ matrix.index }} ${{ matrix.total }} auto') || !azurePipeline.includes('ci:report:bundle -- core "$(System.JobPositionInPhase)" "$(System.TotalJobsInPhase)" auto')) issues.push('CI empty-shard topology contract missing');
  if (!merge.includes('No core business scenarios were selected') || !mergeContract.includes('intentionally empty over-sharded worker') || !mergeContract.includes('all core workers selecting zero business tests')) issues.push('zero-selection vs over-sharding merge contract missing');
} catch (error) {
  issues.push(`unable to validate reporting merge/evidence contracts: ${error.message}`);
}


// Portfolio, AI-selection and agent-authoring contracts (v1.4.1+).
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const portfolioRunner = fs.readFileSync(path.join(root, 'scripts/test-projects.ts'), 'utf8');
  const portfolioWriter = fs.readFileSync(path.join(root, 'src/framework/reporting/portfolio-dashboard.writer.ts'), 'utf8');
  const proposalReview = fs.readFileSync(path.join(root, 'src/framework/intelligence/review/proposal.review.ts'), 'utf8');
  const generator = fs.readFileSync(path.join(root, 'src/framework/intelligence/generation/framework.generator.ts'), 'utf8');
  const newTest = fs.readFileSync(path.join(root, 'scripts/new-test.ts'), 'utf8');
  const githubWorkflow = normalizeContractText(fs.readFileSync(path.join(root, '.github/workflows/playwright-sharded.yml'), 'utf8'));
  const azurePipeline = normalizeContractText(fs.readFileSync(path.join(root, 'azure-pipelines.yml'), 'utf8'));
  const sdetAuthProvider = fs.readFileSync(path.join(root, 'projects/sdet-practice/auth/auth.provider.ts'), 'utf8');
  if (!portfolioRunner.includes('writePortfolioDashboard') || !portfolioRunner.includes('Known defects') && !portfolioWriter.includes('Known defects')) issues.push('business-friendly portfolio dashboard contract missing');
  if (!portfolioRunner.includes('resolveProviderOrder') || !portfolioRunner.includes('--include-ai requires AI_ENABLED=true')) issues.push('portfolio AI provider preflight contract missing');
  if (!githubWorkflow.includes("ALLOW_AI_TESTS: 'true'") || !azurePipeline.includes('ALLOW_AI_TESTS=true')) issues.push('dedicated CI AI lane must explicitly allow @ai tests');
  for (const scriptName of ['test:ai-healing', 'test:ai-healing:ollama', 'test:ai-healing:gemini']) {
    if (!String(pkg.scripts?.[scriptName] ?? '').includes('ALLOW_AI_TESTS=true')) issues.push(`${scriptName} must explicitly opt into @ai selection`);
  }
  if (!proposalReview.includes('agent-generated database validation must remain read-only') || !proposalReview.includes('BaseApiClient/domain-service contract')) issues.push('generated API/DB proposal safety gate missing');
  if (!generator.includes('layers: analysis.suggestedLayers') || !newTest.includes('Target automation layers:')) issues.push('layer-aware agent authoring contract missing');
} catch (error) {
  issues.push(`unable to validate portfolio/agent authoring contracts: ${error.message}`);
}

// Authentication lifecycle release contracts (v1.3.0+).
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const appAuth = fs.readFileSync(path.join(root, 'scripts/app-auth.ts'), 'utf8');
  const authState = fs.readFileSync(path.join(root, 'src/framework/core/auth.state.ts'), 'utf8');
  const authVerifier = fs.readFileSync(path.join(root, 'src/framework/core/auth.verifier.ts'), 'utf8');
  const authManager = fs.readFileSync(path.join(root, 'src/framework/core/auth.manager.ts'), 'utf8');
  const authProvider = fs.readFileSync(path.join(root, 'src/framework/core/auth.provider.ts'), 'utf8');
  const authLock = fs.readFileSync(path.join(root, 'src/framework/core/auth.lock.ts'), 'utf8');
  const testProject = fs.readFileSync(path.join(root, 'scripts/test-project.ts'), 'utf8');
  const basePage = fs.readFileSync(path.join(root, 'src/framework/core/ui/base.page.ts'), 'utf8');
  const fixture = fs.readFileSync(path.join(root, 'src/framework/core/fixtures/enterprise.fixture.ts'), 'utf8');
  if (!appAuth.includes('fresh browser context') && !appAuth.includes('verifyContext')) issues.push('qa:auth must verify captured state in a fresh browser context');
  if (!appAuth.includes('promoteVerifiedFile')) issues.push('qa:auth must promote verified state with cross-platform replacement fallback');
  if (!authState.includes('SessionStorageSnapshot') || !authState.includes('atomicWriteJson') || !authState.includes('applyLocalStorageStateToPage')) issues.push('atomic/live browser storage auth persistence contract missing');
  if (!fixture.includes('installSessionStorageSnapshot')) issues.push('enterprise fixture must restore sessionStorage auth state before test navigation');
  if (!authVerifier.includes('AUTH_SESSION_INVALID')) issues.push('explicit invalid-auth runtime diagnostic missing');
  if (!basePage.includes('AuthManager') || !basePage.includes('ensureAuthenticatedNavigation') || !basePage.includes('ensureFreshBeforeAction')) issues.push('authenticated navigation/actions must use lifecycle recovery before locator healing');
  if (!authManager.includes('acquireFileLock') || !authManager.includes('setStorageState') || !authManager.includes('validateAndPromote')) issues.push('single-flight verified hot auth refresh contract missing');
  if (!authManager.includes('shouldRefreshProactively') || !authManager.includes('refreshAndReplayNavigation') || !authManager.includes('ensureFreshBeforeAction')) issues.push('safe-boundary proactive auth refresh contract missing');
  if (!authProvider.includes('loadProjectAuthProvider')) issues.push('project-owned pluggable auth provider contract missing');
  if (!authLock.includes("openSync(file, 'wx'")) issues.push('cross-process auth refresh lock contract missing');
  if (!testProject.includes('prepareForRun')) issues.push('test:project must prepare auth before Playwright worker fan-out');
  if (!pkg.scripts?.['auth:prepare'] || !pkg.scripts?.['auth:check']) issues.push('auth lifecycle CLI scripts missing');
} catch (error) {
  issues.push(`unable to validate auth lifecycle contracts: ${error.message}`);
}


// Independent architect-review hardening contracts (v1.5.0+).
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const redactor = fs.readFileSync(path.join(root, 'src/framework/logging/redactor.ts'), 'utf8');
  const apiClient = fs.readFileSync(path.join(root, 'src/framework/api/base-api.client.ts'), 'utf8');
  const aiGateway = fs.readFileSync(path.join(root, 'src/framework/ai/ai.gateway.ts'), 'utf8');
  const egress = fs.readFileSync(path.join(root, 'src/framework/ai/ai-egress.policy.ts'), 'utf8');
  const providerUtils = fs.readFileSync(path.join(root, 'src/framework/ai/ai-provider.utils.ts'), 'utf8');
  const httpProvider = fs.readFileSync(path.join(root, 'src/framework/ai/http-ai.provider.ts'), 'utf8');
  const fixture = fs.readFileSync(path.join(root, 'src/framework/core/fixtures/enterprise.fixture.ts'), 'utf8');
  const runContext = fs.readFileSync(path.join(root, 'src/framework/core/config/run.context.ts'), 'utf8');
  const runtimeConfig = fs.readFileSync(path.join(root, 'src/framework/core/config/runtime.config.ts'), 'utf8');
  const projectPaths = fs.readFileSync(path.join(root, 'src/framework/core/config/project.paths.ts'), 'utf8');
  const cache = fs.readFileSync(path.join(root, 'src/framework/healing/healing.cache.ts'), 'utf8');
  const healer = fs.readFileSync(path.join(root, 'src/framework/healing/healing.orchestrator.ts'), 'utf8');
  const security = fs.readFileSync(path.join(root, 'src/framework/security/advisory.policy.ts'), 'utf8');
  const securityConfig = JSON.parse(fs.readFileSync(path.join(root, 'config/security-exceptions.json'), 'utf8'));
  const reviewTests = fs.readFileSync(path.join(root, 'tests/framework/review-hardening-contract.spec.ts'), 'utf8');
  const browserFree = fs.readFileSync(path.join(root, 'tests/framework/browser-free-fixtures.spec.ts'), 'utf8');
  const migration = fs.readFileSync(path.join(root, 'scripts/migration-assess.ts'), 'utf8');
  const reportHistory = fs.readFileSync(path.join(root, 'src/framework/reporting/report-history.store.ts'), 'utf8');
  const durationHistory = fs.readFileSync(path.join(root, 'src/framework/execution/duration-history.store.ts'), 'utf8');
  const evidencePolicy = fs.readFileSync(path.join(root, 'src/framework/logging/evidence.policy.ts'), 'utf8');
  const evidenceRetention = fs.readFileSync(path.join(root, 'src/framework/logging/evidence.retention.ts'), 'utf8');
  const mergeReports = fs.readFileSync(path.join(root, 'scripts/merge-business-reports.ts'), 'utf8');
  const portfolioRunner = fs.readFileSync(path.join(root, 'scripts/test-projects.ts'), 'utf8');
  const githubWorkflow = normalizeContractText(fs.readFileSync(path.join(root, '.github/workflows/playwright-sharded.yml'), 'utf8'));
  const azurePipeline = normalizeContractText(fs.readFileSync(path.join(root, 'azure-pipelines.yml'), 'utf8'));
  const sdetAuthProvider = fs.readFileSync(path.join(root, 'projects/sdet-practice/auth/auth.provider.ts'), 'utf8');

  if (!sdetAuthProvider.includes("requiredSecret('AUTH_USERNAME')") || !sdetAuthProvider.includes("requiredSecret('AUTH_PASSWORD')")) issues.push('A1 sample auth provider must not commit credential-shaped fallbacks');
  if (!redactor.includes('sanitizeText') || !redactor.includes('sanitizeUrl') || !redactor.includes('sanitizeAndTruncate')) issues.push('A1 shared free-text/URL/sanitize-before-truncate redaction contract missing');
  if (!apiClient.includes('sanitizeAndTruncate(body') || !apiClient.includes('sanitizeUrl(url)')) issues.push('A1 API evidence must sanitize URL/body before persistence');
  if (!aiGateway.includes('accessibilitySnapshot: sanitizeText') || !aiGateway.includes('allowedDescriptorTypes')) issues.push('A1 outbound AI evidence allowlist/sanitization contract missing');
  if (!evidencePolicy.includes("EVIDENCE_VISUAL_POLICY ?? 'masked'") || !evidencePolicy.includes('EVIDENCE_ALLOW_UNMASKED_VISUALS') || !evidenceRetention.includes('EVIDENCE_RETENTION_DAYS')) issues.push('A1 secure visual-evidence masking/retention policy missing');
  if (!egress.includes('assertAiDestinationAllowed') || !egress.includes('AI_ALLOWED_EXTERNAL_ORIGINS') || egress.includes('BUILTIN_EXTERNAL_ORIGINS') || !providerUtils.includes("redirect: 'manual'") || !providerUtils.includes('assertAiDestinationAllowed') || !providerUtils.includes('AI_EGRESS_REDIRECT_BLOCKED') || !providerUtils.includes("'authorization', 'cookie', 'proxy-authorization'") || !providerUtils.includes('headers.delete(name)')) issues.push('A2 exact destination/redirect egress enforcement contract missing');
  if (!githubWorkflow.includes('AI_ALLOWED_EXTERNAL_ORIGINS:') || !azurePipeline.includes('AI_ALLOWED_EXTERNAL_ORIGINS:')) issues.push('A2 CI must propagate explicit external AI origin allowlists');
  if (/\{\s*auto:\s*true\s*\}/.test(fixture) && fixture.includes('_authStateBootstrap')) issues.push('A3 automatic auth fixture must not force browser/context for non-UI tests');
  if (!fixture.includes('context: async') || !browserFree.includes('API/data/DB fixture graph does not request browser or context')) issues.push('A3 demand-driven context/browser-free regression contract missing');
  const browserFreeScript = String(pkg.scripts?.['test:review:browser-free'] ?? '');
  const githubBrowserFree = githubWorkflow.indexOf('npm run test:review:browser-free');
  const githubBrowserInstall = githubWorkflow.indexOf('npx playwright install --with-deps chromium');
  const azureBrowserFree = azurePipeline.indexOf('npm run test:review:browser-free');
  const azureBrowserInstall = azurePipeline.indexOf('npx playwright install --with-deps chromium');
  if (!browserFreeScript.includes('browser-free-fixtures.spec.ts') || !browserFreeScript.includes('PLAYWRIGHT_BROWSERS_PATH=.runtime/browser-free-proof') || githubBrowserFree < 0 || githubBrowserInstall < 0 || githubBrowserFree > githubBrowserInstall || azureBrowserFree < 0 || azureBrowserInstall < 0 || azureBrowserFree > azureBrowserInstall) issues.push('A3 browser-free acceptance must execute in CI before browser binaries are installed');
  if (!runContext.includes("'.runtime', 'runs'") || !runContext.includes("'.runtime', 'latest-run'") || !runtimeConfig.includes("'reports', target.application, target.environment, runId") || !projectPaths.includes('assertSafeRunId') || !projectPaths.includes("const id = runId?.trim() || process.env.RUN_ID?.trim();") || !projectPaths.includes('static latestRunId') || !projectPaths.includes("const current = process.env.RUN_ID?.trim();")) issues.push('A4 immutable run-scoped artifact/path validation contract missing');
  if (!mergeReports.includes('enforceExecutionIdentity') || !mergeReports.includes('Cross-execution business merge blocked') || !portfolioRunner.includes('RunContext.ensure()') || !portfolioRunner.includes('target.environment, runId')) issues.push('A4 merge/portfolio consumers must preserve immutable execution identity');
  if (!cache.includes('schemaVersion: 2') || !cache.includes('planRevision') || !cache.includes("openSync(this.lockPath, 'wx')") || !cache.includes('expiresAt') || !cache.includes('pruneIfStillInvalid')) issues.push('A5 healing-cache provenance/expiry/concurrency contract missing');
  if (!healer.includes('HEALING_PRIMARY_READY_TIMEOUT_MS') || !healer.includes("waitFor({ state: 'visible'")) issues.push('A6 bounded primary locator readiness contract missing');
  if (!httpProvider.includes('AiProviderError') || !httpProvider.includes('fetchWithTimeout') || !httpProvider.includes("'invalid-response'") || !providerUtils.includes('resolveAiTimeoutMs')) issues.push('A7 generic HTTP timeout/schema/error contract missing');
  if (!security.includes('advisoryId') || !security.includes('expiresAt') || !security.includes('unresolved:${packageName}') || securityConfig.schemaVersion !== 1 || !Array.isArray(securityConfig.exceptions)) issues.push('A8 advisory-scoped/fail-closed security exception policy missing');
  if (!pkg.scripts?.['test:review:hardening'] || !String(pkg.scripts?.['validate:final:steps'] ?? '').includes('test:review:hardening') || !String(pkg.scripts?.['test:review:hardening'] ?? '').includes('healing-generation-contract.spec.ts')) issues.push('architect-review regression suite must gate A1-A8 including delayed-primary recovery');
  if (!reviewTests.includes('A1 removes canary secrets') || !reviewTests.includes('A8 a new advisory')) issues.push('architect-review executable acceptance coverage missing');
  if (!pkg.scripts?.['migration:assess'] || !pkg.scripts?.['qa:migrate'] || !migration.includes('adoption aid')) issues.push('existing-Playwright migration assessment path missing');
  if (!pkg.scripts?.['release:compat:probe'] || !fs.readFileSync(path.join(root, '.github/workflows/release-compatibility.yml'), 'utf8').includes('Architect-review and recovery regression')) issues.push('release compatibility evidence workflow/probe missing');
  if (!reportHistory.includes("'.report-history', application, environment") || !reportHistory.includes("openSync(lock, 'wx')") || !durationHistory.includes("'.report-history', app, env") || !durationHistory.includes("openSync(lock, 'wx')")) issues.push('shared history must be environment-scoped and lock-protected');
} catch (error) {
  issues.push(`unable to validate architect-review hardening contracts: ${error.message}`);
}

for (const file of walk(root).filter(f => f.endsWith('.json'))) {
  try { JSON.parse(fs.readFileSync(file, 'utf8')); } catch (error) { issues.push(`invalid JSON ${path.relative(root, file)}: ${error.message}`); }
}

for (const file of walk(root).filter(f => f.endsWith('.ts'))) {
  const text = fs.readFileSync(file, 'utf8');
  const rx = /(?:from\s+|import\s*\()(['"])(\.{1,2}\/[^'"]+)\1/g;
  for (const match of text.matchAll(rx)) {
    const spec = match[2];
    const base = path.resolve(path.dirname(file), spec);
    const raw = base.endsWith('.js') ? base.slice(0, -3) : base;
    const candidates = [base, `${raw}.ts`, `${raw}.tsx`, path.join(raw, 'index.ts')];
    if (!candidates.some(fs.existsSync)) issues.push(`unresolved internal import ${path.relative(root, file)} -> ${spec}`);
  }
}

if (issues.length) {
  console.error(JSON.stringify({ ok: false, issues }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, projects: fs.readdirSync(path.join(root, 'projects')).sort(), filesChecked: walk(root).length }, null, 2));
