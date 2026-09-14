import fs from 'node:fs';
import path from 'node:path';
import { loadRequirement } from '../intelligence/adapters/source.factory.js';
import { analyzeRequirement } from '../intelligence/knowledge/analyzer.js';
import { buildAgenticTestPlan } from '../agentic/planner/test-planner.js';
import { analyzeAgenticImpact } from '../agentic/planner/impact-planner.js';
import { orchestrateGenerationProposal } from '../agentic/orchestration/agentic-orchestrator.js';
import { AgentDecisionLedger } from '../agentic/evidence/agent-decision-ledger.js';
import type { AgenticMcpContext, McpToolDefinition } from './contracts.js';
import { assertExactObjectKeys, boundedMcpString, boundedMcpStringArray, resolveMcpRequirementPath } from './security-policy.js';
import { assertSafeProjectName, resolveProjectScopedPath, resolveWorkspacePath } from '../agentic/policy/path-policy.js';
import type { GeneratedArtifactKind } from '../agentic/contracts/generation.types.js';
import { analyzeFailureIntelligence } from '../failure-intelligence/failure-analyzer.js';
import { classifyFailureDeterministically } from '../failure-intelligence/deterministic-classifier.js';
import type { FailureSignal } from '../failure-intelligence/failure-intelligence.types.js';

const GENERATION_KINDS = new Set<GeneratedArtifactKind>(['test', 'page-object', 'api-client', 'fixture', 'test-data']);

/** Returns the governed read/review-oriented MCP catalog; failure triage tools remain in-memory and cannot promote source changes. */
export function listAgenticMcpTools(): McpToolDefinition[] {
  return [
    {
      name: 'testigent_list_projects', title: 'List TestigentAI projects',
      description: 'List configured projects under projects/. This is read-only.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    {
      name: 'testigent_plan_requirement', title: 'Plan requirement tests',
      description: 'Build a deterministic evidence-backed agentic test plan from a local project requirement file. No source code is written.',
      inputSchema: { type: 'object', properties: { project: { type: 'string' }, requirementFile: { type: 'string' } }, required: ['project', 'requirementFile'], additionalProperties: false },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    {
      name: 'testigent_analyze_impact', title: 'Analyze test impact',
      description: 'Analyze workspace-relative changed paths against one project and rank potentially impacted tests.',
      inputSchema: { type: 'object', properties: { project: { type: 'string' }, changedPaths: { type: 'array', items: { type: 'string' }, maxItems: 100 } }, required: ['project', 'changedPaths'], additionalProperties: false },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    {
      name: 'testigent_discover_tests', title: 'Discover project tests',
      description: 'Discover project Playwright spec files, optionally filtered by a plain-text query.',
      inputSchema: { type: 'object', properties: { project: { type: 'string' }, query: { type: 'string' } }, required: ['project'], additionalProperties: false },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    {
      name: 'testigent_review_generation', title: 'Review generation proposal',
      description: 'Create and deterministically review an in-memory generation proposal. It does not write or promote project source.',
      inputSchema: { type: 'object', properties: { project: { type: 'string' }, planId: { type: 'string' }, requirementRef: { type: 'string' }, kind: { type: 'string', enum: [...GENERATION_KINDS] }, targetPath: { type: 'string' }, content: { type: 'string' }, rationale: { type: 'string' }, confidence: { type: ['number', 'null'], minimum: 0, maximum: 1 }, provider: { type: 'string' }, model: { type: 'string' } }, required: ['project', 'planId', 'requirementRef', 'kind', 'targetPath', 'content', 'rationale'], additionalProperties: false },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    {
      name: 'testigent_get_agentic_evidence', title: 'Get agentic evidence',
      description: 'Read the sanitized run-scoped agent decision ledger and compact summary.',
      inputSchema: { type: 'object', properties: { project: { type: 'string' }, environment: { type: 'string' }, runId: { type: 'string' } }, required: ['project'], additionalProperties: false },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    {
      name: 'testigent_explain_failure', title: 'Explain one failure',
      description: 'Classify one bounded failure-evidence object deterministically. UNKNOWN remains UNKNOWN; no source or history is modified.',
      inputSchema: { type: 'object', properties: { signal: failureSignalSchema() }, required: ['signal'], additionalProperties: false },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    {
      name: 'testigent_triage_failures', title: 'Triage failure set',
      description: 'Classify and fingerprint up to 100 failure-evidence objects in memory, returning common-cause incident clusters.',
      inputSchema: { type: 'object', properties: { signals: { type: 'array', items: failureSignalSchema(), minItems: 1, maxItems: 100 } }, required: ['signals'], additionalProperties: false },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
  ];
}

/** Invokes one governed agentic MCP tool and returns structured JSON-safe output. */
export async function invokeAgenticMcpTool(name: string, rawArguments: unknown, context: AgenticMcpContext): Promise<unknown> {
  assertMcpNotCancelled(context);
  const args = strictArguments(rawArguments);
  if (name === 'testigent_list_projects') { assertExactObjectKeys(args, [], 'testigent_list_projects arguments'); return listProjects(context.root); }
  if (name === 'testigent_explain_failure') { assertExactObjectKeys(args, ['signal'], 'testigent_explain_failure arguments'); return classifyFailureDeterministically(parseFailureSignal(args.signal)); }
  if (name === 'testigent_triage_failures') {
    assertExactObjectKeys(args, ['signals'], 'testigent_triage_failures arguments');
    if (!Array.isArray(args.signals) || args.signals.length < 1 || args.signals.length > 100) throw new Error('signals must contain between 1 and 100 failure evidence objects.');
    return analyzeFailureIntelligence(args.signals.map(parseFailureSignal));
  }
  if (name === 'testigent_plan_requirement') {
    assertExactObjectKeys(args, ['project', 'requirementFile'], 'testigent_plan_requirement arguments');
    const project = assertSafeProjectName(boundedMcpString(args.project, 'project', 80));
    const file = resolveMcpRequirementPath(context.root, project, boundedMcpString(args.requirementFile, 'requirementFile', 500));
    const requirement = await loadRequirement(file);
    assertMcpNotCancelled(context);
    const analysis = await analyzeRequirement(context.root, requirement);
    assertMcpNotCancelled(context);
    if (analysis.applicationResolution?.app && analysis.applicationResolution.app !== project) throw new Error(`Requirement resolved to '${analysis.applicationResolution.app}' but MCP request selected '${project}'.`);
    const plan = buildAgenticTestPlan({ ...analysis, applicationResolution: { ...(analysis.applicationResolution ?? { source: 'unresolved', reason: 'MCP project scope', candidates: [] }), app: project } });
    const ledger = AgentDecisionLedger.forRun(context.root, project, context.environment, context.runId);
    ledger.append({ runId: context.runId, application: project, environment: context.environment, agent: 'planner', operation: 'plan-requirement', state: plan.state, rationale: plan.rationale, confidence: plan.confidence, policyPassed: plan.conflicts.length === 0, deterministicValidationPassed: plan.state !== 'REJECTED', humanApprovalRequired: plan.state !== 'ACCEPTED', humanApproved: false, evidence: plan.evidence, affectedArtifacts: plan.scenarios.map(item => item.id) });
    return plan;
  }
  if (name === 'testigent_analyze_impact') {
    assertExactObjectKeys(args, ['project', 'changedPaths'], 'testigent_analyze_impact arguments');
    const project = assertSafeProjectName(boundedMcpString(args.project, 'project', 80));
    const changedPaths = boundedMcpStringArray(args.changedPaths, 'changedPaths', 100, 500);
    for (const changed of changedPaths) resolveWorkspacePath(context.root, changed);
    assertMcpNotCancelled(context);
    const result = analyzeAgenticImpact(context.root, project, changedPaths);
    assertMcpNotCancelled(context);
    const ledger = AgentDecisionLedger.forRun(context.root, project, context.environment, context.runId);
    ledger.append({ runId: context.runId, application: project, environment: context.environment, agent: 'planner', operation: 'analyze-impact', state: result.state, rationale: result.rationale, confidence: result.affectedTests[0]?.score ?? null, policyPassed: true, deterministicValidationPassed: true, humanApprovalRequired: result.state !== 'ACCEPTED', humanApproved: false, evidence: result.evidence, affectedArtifacts: result.affectedTests.map(item => item.testPath) });
    return result;
  }
  if (name === 'testigent_discover_tests') {
    assertExactObjectKeys(args, ['project', 'query'], 'testigent_discover_tests arguments');
    const project = assertSafeProjectName(boundedMcpString(args.project, 'project', 80));
    const query = typeof args.query === 'string' ? args.query.trim().toLowerCase().slice(0, 200) : '';
    return discoverTests(context.root, project, query, context.abortSignal);
  }
  if (name === 'testigent_review_generation') {
    assertExactObjectKeys(args, ['project', 'planId', 'requirementRef', 'kind', 'targetPath', 'content', 'rationale', 'confidence', 'provider', 'model'], 'testigent_review_generation arguments');
    const project = assertSafeProjectName(boundedMcpString(args.project, 'project', 80));
    const kind = boundedMcpString(args.kind, 'kind', 40) as GeneratedArtifactKind;
    if (!GENERATION_KINDS.has(kind)) throw new Error(`Unsupported generation kind '${kind}'.`);
    const ledger = AgentDecisionLedger.forRun(context.root, project, context.environment, context.runId);
    const confidence = args.confidence === null || args.confidence === undefined ? null : Number(args.confidence);
    if (confidence !== null && (!Number.isFinite(confidence) || confidence < 0 || confidence > 1)) throw new Error('confidence must be null or a number between 0 and 1.');
    assertMcpNotCancelled(context);
    return orchestrateGenerationProposal(context.root, ledger, { runId: context.runId, application: project, environment: context.environment }, {
      project,
      planId: boundedMcpString(args.planId, 'planId', 160),
      requirementRef: boundedMcpString(args.requirementRef, 'requirementRef', 200),
      kind,
      targetPath: boundedMcpString(args.targetPath, 'targetPath', 600),
      content: boundedMcpString(args.content, 'content', 250_000),
      rationale: boundedMcpString(args.rationale, 'rationale', 4_000),
      confidence,
      ...(typeof args.provider === 'string' && args.provider.trim() ? { provider: args.provider.trim().slice(0, 100) } : {}),
      ...(typeof args.model === 'string' && args.model.trim() ? { model: args.model.trim().slice(0, 160) } : {}),
    });
  }
  if (name === 'testigent_get_agentic_evidence') {
    assertExactObjectKeys(args, ['project', 'environment', 'runId'], 'testigent_get_agentic_evidence arguments');
    const project = assertSafeProjectName(boundedMcpString(args.project, 'project', 80));
    const environment = typeof args.environment === 'string' && args.environment.trim() ? boundedMcpString(args.environment, 'environment', 80) : context.environment;
    const runId = typeof args.runId === 'string' && args.runId.trim() ? boundedMcpString(args.runId, 'runId', 160) : context.runId;
    const ledger = AgentDecisionLedger.forRun(context.root, project, environment, runId);
    return { summary: ledger.summary(), decisions: ledger.read() };
  }
  throw new Error(`Unknown MCP tool '${name}'.`);
}

function listProjects(root: string): Array<{ project: string; displayName?: string }> {
  const projectsRoot = path.join(root, 'projects');
  if (!fs.existsSync(projectsRoot)) return [];
  return fs.readdirSync(projectsRoot, { withFileTypes: true }).filter((entry: { isDirectory(): boolean }) => entry.isDirectory()).map((entry: { name: string }) => {
    const projectFile = path.join(projectsRoot, entry.name, 'project.json');
    let displayName: string | undefined;
    try { const parsed = JSON.parse(fs.readFileSync(projectFile, 'utf8')) as Record<string, unknown>; displayName = typeof parsed.name === 'string' ? parsed.name : undefined; } catch { /* metadata is optional */ }
    return { project: entry.name, ...(displayName ? { displayName } : {}) };
  }).sort((a: { project: string }, b: { project: string }) => a.project.localeCompare(b.project));
}

function discoverTests(root: string, project: string, query: string, abortSignal?: AbortSignal): Array<{ path: string; tags: string[] }> {
  const testsRoot = resolveProjectScopedPath(root, project, 'tests', { mustExist: true });
  const walk = (directory: string): string[] => fs.existsSync(directory) ? fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry: { name: string; isDirectory(): boolean }) => entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]) : [];
  const output: Array<{ path: string; tags: string[] }> = [];
  for (const file of walk(testsRoot).filter(candidate => /\.spec\.(?:ts|js)$/.test(candidate))) {
    if (abortSignal?.aborted) throw abortError();
    const text = fs.readFileSync(file, 'utf8');
    const relative = path.relative(root, file).replaceAll('\\', '/');
    if (query && !`${relative}\n${text}`.toLowerCase().includes(query)) continue;
    const tags: string[] = [...new Set<string>(text.match(/@[A-Za-z0-9._:-]+/g) ?? [])].slice(0, 40);
    output.push({ path: relative, tags });
  }
  return output.sort((a, b) => a.path.localeCompare(b.path));
}


function assertMcpNotCancelled(context: AgenticMcpContext): void { if (context.abortSignal?.aborted) throw abortError(); }
function abortError(): Error { const error = new Error('MCP request cancelled.'); error.name = 'AbortError'; return error; }

const FAILURE_SIGNAL_FIELDS = ['scenarioId', 'title', 'application', 'project', 'businessStep', 'error', 'endpoint', 'httpStatus', 'contractViolation', 'authStatus', 'environmentSignal', 'dependencySignal', 'testDataSignal', 'locatorSignal', 'healingOutcome', 'flaky', 'retriesUsed', 'knownDefectId', 'consoleError', 'traceRef', 'screenshotRef'] as const;

function strictArguments(raw: unknown): Record<string, unknown> {
  if (raw === undefined) return {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('MCP tool arguments must be an object.');
  return raw as Record<string, unknown>;
}

function failureSignalSchema(): Record<string, unknown> {
  return { type: 'object', properties: {
    scenarioId: { type: 'string', maxLength: 160 }, title: { type: 'string', maxLength: 500 }, application: { type: 'string', maxLength: 100 }, project: { type: 'string', maxLength: 100 }, businessStep: { type: 'string', maxLength: 500 }, error: { type: 'string', maxLength: 4000 }, endpoint: { type: 'string', maxLength: 500 }, httpStatus: { type: 'number', minimum: 100, maximum: 599 }, contractViolation: { type: 'string', maxLength: 2000 }, authStatus: { type: 'string', enum: ['VALID', 'INVALID', 'EXPIRED', 'NOT_CONFIGURED'] }, environmentSignal: { type: 'string', maxLength: 2000 }, dependencySignal: { type: 'string', maxLength: 2000 }, testDataSignal: { type: 'string', maxLength: 2000 }, locatorSignal: { type: 'string', maxLength: 2000 }, healingOutcome: { type: 'string', enum: ['VALIDATED', 'REJECTED', 'SUGGESTED', 'UNVERIFIED', 'NONE'] }, flaky: { type: 'boolean' }, retriesUsed: { type: 'number', minimum: 0, maximum: 50 }, knownDefectId: { type: 'string', maxLength: 160 }, consoleError: { type: 'string', maxLength: 4000 }, traceRef: { type: 'string', maxLength: 500 }, screenshotRef: { type: 'string', maxLength: 500 },
  }, required: ['scenarioId', 'title', 'application'], additionalProperties: false };
}

function parseFailureSignal(raw: unknown): FailureSignal {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('signal must be an object.');
  const value = raw as Record<string, unknown>;
  assertExactObjectKeys(value, FAILURE_SIGNAL_FIELDS, 'failure signal');
  const signal: FailureSignal = {
    scenarioId: boundedMcpString(value.scenarioId, 'scenarioId', 160),
    title: boundedMcpString(value.title, 'title', 500),
    application: boundedMcpString(value.application, 'application', 100),
    evidenceMode: 'UNVERIFIED', synthetic: false, claimEligible: false,
  };
  for (const [field, limit] of Object.entries({ project: 100, businessStep: 500, error: 4000, endpoint: 500, contractViolation: 2000, environmentSignal: 2000, dependencySignal: 2000, testDataSignal: 2000, locatorSignal: 2000, knownDefectId: 160, consoleError: 4000, traceRef: 500, screenshotRef: 500 })) {
    if (value[field] !== undefined) (signal as unknown as Record<string, unknown>)[field] = boundedMcpString(value[field], field, limit);
  }
  if (value.httpStatus !== undefined) {
    if (typeof value.httpStatus !== 'number') throw new Error('httpStatus must be a number.'); const status = value.httpStatus; if (!Number.isInteger(status) || status < 100 || status > 599) throw new Error('httpStatus must be an HTTP status integer.'); signal.httpStatus = status;
  }
  if (value.retriesUsed !== undefined) {
    if (typeof value.retriesUsed !== 'number') throw new Error('retriesUsed must be a number.'); const retries = value.retriesUsed; if (!Number.isInteger(retries) || retries < 0 || retries > 50) throw new Error('retriesUsed must be an integer from 0 to 50.'); signal.retriesUsed = retries;
  }
  if (value.flaky !== undefined) { if (typeof value.flaky !== 'boolean') throw new Error('flaky must be a boolean.'); signal.flaky = value.flaky; }
  if (value.authStatus !== undefined) { if (typeof value.authStatus !== 'string' || !['VALID', 'INVALID', 'EXPIRED', 'NOT_CONFIGURED'].includes(value.authStatus)) throw new Error('authStatus is invalid.'); signal.authStatus = value.authStatus as FailureSignal['authStatus']; }
  if (value.healingOutcome !== undefined) { if (typeof value.healingOutcome !== 'string' || !['VALIDATED', 'REJECTED', 'SUGGESTED', 'UNVERIFIED', 'NONE'].includes(value.healingOutcome)) throw new Error('healingOutcome is invalid.'); signal.healingOutcome = value.healingOutcome as FailureSignal['healingOutcome']; }
  return signal;
}
