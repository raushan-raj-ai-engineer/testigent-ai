import fs from 'node:fs';
import path from 'node:path';

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
  for (const scenarioScript of ['scenario:help', 'scenario:list', 'scenario:validate', 'scenario:new', 'scenario:run', 'scenario:doctor', 'scenario:schema', 'scenario:schema:check']) {
    if (!pkg.scripts?.[scenarioScript]) issues.push(`missing declarative authoring script: ${scenarioScript}`);
  }
  const finalValidationContract = `${pkg.scripts?.['validate:final'] ?? ''} ${pkg.scripts?.['validate:final:steps'] ?? ''}`;
  if (!finalValidationContract.includes('scenario:doctor')) issues.push('validate:final must enforce scenario:doctor');
  if (!pkg.scripts?.['mcp:start']?.includes('start-mcp.ts')) issues.push('mcp:start must use env-driven start-mcp.ts wrapper');
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
  if (!/^DB_TYPE=\s*$/m.test(envExample)) issues.push('.env.example must not impose a default database type; project/environment config owns it');
}



// CI merge topology contracts: core shard completeness and AI lane completeness are independent.
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  if (!pkg.scripts?.['ci:report:bundle']?.includes('ci-report-bundle.ts')) issues.push('missing ci:report:bundle topology marker script');
  const githubWorkflow = fs.readFileSync(path.join(root, '.github/workflows/playwright-sharded.yml'), 'utf8');
  if (!githubWorkflow.includes('EXPECTED_CORE_REPORTS')) issues.push('GitHub merge must enforce core report count independently');
  if (!githubWorkflow.includes('EXPECT_AI_LANE')) issues.push('GitHub merge must validate the optional AI lane independently');
  if (!githubWorkflow.includes('ci:report:bundle -- core') || !githubWorkflow.includes('ci:report:bundle -- ai')) issues.push('GitHub CI must publish core/AI bundle topology markers');
  if (!githubWorkflow.includes('CI_SHARDS') || !githubWorkflow.includes('inputs.shards')) issues.push('GitHub CI must support configurable sequential/sharded execution');
  if (githubWorkflow.includes("EXPECTED_BUSINESS_REPORTS: '2'")) issues.push('GitHub merge must not hardcode two business reports');
  const azureWorkflow = fs.readFileSync(path.join(root, 'azure-pipelines.yml'), 'utf8');
  if (!azureWorkflow.includes('EXPECTED_CORE_REPORTS=') || !azureWorkflow.includes('EXPECT_AI_LANE=')) issues.push('Azure merge must independently validate core and AI lanes');
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
  const githubWorkflow = fs.readFileSync(path.join(root, '.github/workflows/playwright-sharded.yml'), 'utf8');
  const azurePipeline = fs.readFileSync(path.join(root, 'azure-pipelines.yml'), 'utf8');
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
  if (!githubWorkflow.includes('continue-on-error: true\n        shell: bash\n        run: npm run --silent ci:business:summary')) issues.push('GitHub merged-report summary must remain informational/non-blocking');
  if (githubWorkflow.includes("<<'NODE'") || githubWorkflow.includes('GITHUB\\_STEP\\_SUMMARY')) issues.push('GitHub merged-report summary must not use fragile heredoc/escaped step-summary syntax');
  if (!merge.includes('EXPECTED_CORE_REPORTS') || !merge.includes('EXPECT_AI_LANE') || !githubWorkflow.includes('EXPECTED_CORE_REPORTS:') || !githubWorkflow.includes('EXPECT_AI_LANE:') || !azurePipeline.includes('EXPECTED_CORE_REPORTS="${{ parameters.shards }}"') || !azurePipeline.includes('EXPECT_AI_LANE="${{ parameters.runAi }}"')) issues.push('CI merged-report core/AI topology guard missing');
} catch (error) {
  issues.push(`unable to validate reporting merge/evidence contracts: ${error.message}`);
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
