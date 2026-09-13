import fs from 'node:fs';
import path from 'node:path';
import { loadRequirement } from '../intelligence/adapters/source.factory.js';
import { analyzeRequirement } from '../intelligence/knowledge/analyzer.js';
import { buildAgenticTestPlan } from '../agentic/planner/test-planner.js';
import { analyzeAgenticImpact } from '../agentic/planner/impact-planner.js';
import { orchestrateGenerationProposal } from '../agentic/orchestration/agentic-orchestrator.js';
import { AgentDecisionLedger } from '../agentic/evidence/agent-decision-ledger.js';
import type { AgenticMcpContext, McpToolDefinition } from './contracts.js';
import { boundedMcpString, boundedMcpStringArray, resolveMcpRequirementPath } from './security-policy.js';
import { assertSafeProjectName, resolveWorkspacePath } from '../agentic/policy/path-policy.js';
import type { GeneratedArtifactKind } from '../agentic/contracts/generation.types.js';

const GENERATION_KINDS = new Set<GeneratedArtifactKind>(['test', 'page-object', 'api-client', 'fixture', 'test-data']);

/** Returns the fixed v1.7 read/review-oriented MCP tool catalog; no tool can promote source changes. */
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
  ];
}

/** Invokes one governed agentic MCP tool and returns structured JSON-safe output. */
export async function invokeAgenticMcpTool(name: string, rawArguments: unknown, context: AgenticMcpContext): Promise<unknown> {
  const args = rawArguments && typeof rawArguments === 'object' && !Array.isArray(rawArguments) ? rawArguments as Record<string, unknown> : {};
  if (name === 'testigent_list_projects') return listProjects(context.root);
  if (name === 'testigent_plan_requirement') {
    const project = assertSafeProjectName(boundedMcpString(args.project, 'project', 80));
    const file = resolveMcpRequirementPath(context.root, project, boundedMcpString(args.requirementFile, 'requirementFile', 500));
    const requirement = await loadRequirement(file);
    const analysis = await analyzeRequirement(context.root, requirement);
    if (analysis.applicationResolution?.app && analysis.applicationResolution.app !== project) throw new Error(`Requirement resolved to '${analysis.applicationResolution.app}' but MCP request selected '${project}'.`);
    const plan = buildAgenticTestPlan({ ...analysis, applicationResolution: { ...(analysis.applicationResolution ?? { source: 'unresolved', reason: 'MCP project scope', candidates: [] }), app: project } });
    const ledger = AgentDecisionLedger.forRun(context.root, project, context.environment, context.runId);
    ledger.append({ runId: context.runId, application: project, environment: context.environment, agent: 'planner', operation: 'plan-requirement', state: plan.state, rationale: plan.rationale, confidence: plan.confidence, policyPassed: plan.conflicts.length === 0, deterministicValidationPassed: plan.state !== 'REJECTED', humanApprovalRequired: plan.state !== 'ACCEPTED', humanApproved: false, evidence: plan.evidence, affectedArtifacts: plan.scenarios.map(item => item.id) });
    return plan;
  }
  if (name === 'testigent_analyze_impact') {
    const project = assertSafeProjectName(boundedMcpString(args.project, 'project', 80));
    const changedPaths = boundedMcpStringArray(args.changedPaths, 'changedPaths', 100, 500);
    for (const changed of changedPaths) resolveWorkspacePath(context.root, changed);
    const result = analyzeAgenticImpact(context.root, project, changedPaths);
    const ledger = AgentDecisionLedger.forRun(context.root, project, context.environment, context.runId);
    ledger.append({ runId: context.runId, application: project, environment: context.environment, agent: 'planner', operation: 'analyze-impact', state: result.state, rationale: result.rationale, confidence: result.affectedTests[0]?.score ?? null, policyPassed: true, deterministicValidationPassed: true, humanApprovalRequired: result.state !== 'ACCEPTED', humanApproved: false, evidence: result.evidence, affectedArtifacts: result.affectedTests.map(item => item.testPath) });
    return result;
  }
  if (name === 'testigent_discover_tests') {
    const project = assertSafeProjectName(boundedMcpString(args.project, 'project', 80));
    const query = typeof args.query === 'string' ? args.query.trim().toLowerCase().slice(0, 200) : '';
    return discoverTests(context.root, project, query);
  }
  if (name === 'testigent_review_generation') {
    const project = assertSafeProjectName(boundedMcpString(args.project, 'project', 80));
    const kind = boundedMcpString(args.kind, 'kind', 40) as GeneratedArtifactKind;
    if (!GENERATION_KINDS.has(kind)) throw new Error(`Unsupported generation kind '${kind}'.`);
    const ledger = AgentDecisionLedger.forRun(context.root, project, context.environment, context.runId);
    const confidence = args.confidence === null || args.confidence === undefined ? null : Number(args.confidence);
    if (confidence !== null && (!Number.isFinite(confidence) || confidence < 0 || confidence > 1)) throw new Error('confidence must be null or a number between 0 and 1.');
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

function discoverTests(root: string, project: string, query: string): Array<{ path: string; tags: string[] }> {
  const testsRoot = resolveWorkspacePath(root, `projects/${project}/tests`);
  const walk = (directory: string): string[] => fs.existsSync(directory) ? fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry: { name: string; isDirectory(): boolean }) => entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]) : [];
  const output: Array<{ path: string; tags: string[] }> = [];
  for (const file of walk(testsRoot).filter(candidate => /\.spec\.(?:ts|js)$/.test(candidate))) {
    const text = fs.readFileSync(file, 'utf8');
    const relative = path.relative(root, file).replaceAll('\\', '/');
    if (query && !`${relative}\n${text}`.toLowerCase().includes(query)) continue;
    const tags: string[] = [...new Set<string>(text.match(/@[A-Za-z0-9._:-]+/g) ?? [])].slice(0, 40);
    output.push({ path: relative, tags });
  }
  return output.sort((a, b) => a.path.localeCompare(b.path));
}
