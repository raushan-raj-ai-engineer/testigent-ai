/** Architecture-aware, review-first generator. Author: Raushan Raj */
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import type { ApplicationKnowledgeMatch, GenerationManifest, RequirementAnalysis, ReusableCandidate } from '../core/models.js';
import { resolveApplicationTarget } from '../knowledge/application.resolver.js';
import { initializeProposalReview } from '../review/proposal.review.js';

const exists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

const kebab = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'generated-feature';
const pascal = (value: string): string => value.replace(/[^a-zA-Z0-9]+/g, ' ').trim().split(/\s+/).map(part => part[0]?.toUpperCase() + part.slice(1)).join('').replace(/^\d+/, '') || 'GeneratedFeature';

function header(requirementId: string): string {
  return `/**\n * GENERATED PROPOSAL - REVIEW_REQUIRED\n * Requirement: ${requirementId}\n * Do not merge before human review.\n * Author: Raushan Raj\n */\n`;
}

function relImport(fromDirectory: string, toFile: string): string {
  let path = relative(fromDirectory, toFile).replace(/\\/g, '/').replace(/\.ts$/, '.js');
  if (!path.startsWith('.')) path = `./${path}`;
  return path;
}

interface MaterializeResult {
  disposition: 'created' | 'refreshed' | 'skipped-generated' | 'reused-existing' | 'conflict-generated';
  ownedByRequirement: boolean;
}

async function materializeProposal(path: string, content: string, requirementId: string): Promise<MaterializeResult> {
  if (!(await exists(path))) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
    return { disposition: 'created', ownedByRequirement: true };
  }

  const existing = await readFile(path, 'utf8');
  const generated = existing.includes('GENERATED PROPOSAL - REVIEW_REQUIRED');
  const sameRequirement = generated && existing.includes(`Requirement: ${requirementId}`);

  if (sameRequirement) {
    if ((process.env.TEST_GENERATION_REFRESH_PROPOSALS ?? 'false').toLowerCase() === 'true') {
      await writeFile(path, content);
      return { disposition: 'refreshed', ownedByRequirement: true };
    }
    return { disposition: 'skipped-generated', ownedByRequirement: true };
  }

  if (generated) return { disposition: 'conflict-generated', ownedByRequirement: false };
  return { disposition: 'reused-existing', ownedByRequirement: false };
}

function exactCandidate(kind: ReusableCandidate['kind'], root: string, path: string): ReusableCandidate {
  return {
    kind,
    name: path.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') ?? path,
    path: relative(root, path).replace(/\\/g, '/'),
    score: 0.99
  };
}

function pushUniqueCandidate(output: ReusableCandidate[], candidate: ReusableCandidate): void {
  if (!output.some(item => item.kind === candidate.kind && item.path === candidate.path)) output.push(candidate);
}

function recordMaterialization(
  manifestCreated: GenerationManifest['created'],
  warnings: string[],
  kind: ReusableCandidate['kind'] | 'test',
  root: string,
  path: string,
  result: MaterializeResult
): void {
  const relativePath = relative(root, path).replace(/\\/g, '/');
  if (result.disposition === 'created' || result.disposition === 'refreshed') {
    manifestCreated.push({
      kind,
      path: relativePath,
      reason: result.disposition === 'created'
        ? `Created missing ${kind} proposal in the existing framework structure.`
        : `Explicitly refreshed same-requirement generated ${kind} proposal.`
    });
    return;
  }
  if (result.disposition === 'skipped-generated') {
    // Keep same-requirement proposal files represented in the manifest on reruns so
    // human review/promotion never loses ownership tracking.
    manifestCreated.push({
      kind,
      path: relativePath,
      reason: `Retained existing same-requirement generated ${kind} proposal.`
    });
    warnings.push(`Existing generated proposal kept unchanged: ${relativePath}. Set TEST_GENERATION_REFRESH_PROPOSALS=true to explicitly refresh same-requirement proposals.`);
  } else if (result.disposition === 'reused-existing') {
    warnings.push(`Human-owned framework file already exists and was not overwritten: ${relativePath}. Human reviewer must confirm its exported API before wiring.`);
  } else {
    warnings.push(`Generated file belongs to a different requirement and was not overwritten: ${relativePath}. Human review is required to resolve the abstraction ownership conflict.`);
  }
}

/**
 * Reusable framework function `generateFrameworkProposal`.
 * Business Use: Centralizes shared TestigentAI behavior so project teams do not duplicate framework logic.
 * Benefit: Keeps behavior consistent, reviewable and reusable across organizations and applications.
 */
export async function generateFrameworkProposal(root: string, analysis: RequirementAnalysis) {
  const requirement = analysis.requirement;
  const feature = kebab(requirement.feature || requirement.title);
  const className = pascal(requirement.feature || requirement.title);
  const created: GenerationManifest['created'] = [];
  const warnings: string[] = [];
  const knowledgeEvidence = (analysis.applicationKnowledge ?? []).filter(item => item.status === 'APPROVED');
  const pendingKnowledge = (analysis.applicationKnowledge ?? []).filter(item => item.status === 'REVIEW_REQUIRED');
  const resolution = analysis.applicationResolution ?? await resolveApplicationTarget(root, requirement, analysis.reusableCandidates);
  if (!resolution.app) {
    throw new Error(`Generation blocked: ${resolution.reason}`);
  }
  const app = resolution.app;
  const candidateApp = (candidate: ReusableCandidate): string | undefined => /(?:^|\/)projects\/([^/]+)\//i.exec(candidate.path.replace(/\\/g, '/'))?.[1];
  const reusableKinds = new Set<ReusableCandidate['kind']>(['page', 'component', 'workflow', 'api-service', 'db-repository']);
  // Supporting app-scoped candidates are only reusable inside the resolved application.
  // Global API/DB abstractions may remain candidates across apps.
  const reused = analysis.reusableCandidates.filter(candidate => {
    if (!reusableKinds.has(candidate.kind) || candidate.score < 0.55) return false;
    const scopedApp = candidateApp(candidate);
    return !scopedApp || scopedApp === app;
  });

  const projectRoot = join(root, 'projects', app);
  const pageDir = join(projectRoot, 'src', 'pages');
  const workflowDir = join(projectRoot, 'src', 'workflows');
  const apiDir = join(projectRoot, 'src', 'api');
  const dbDir = join(projectRoot, 'src', 'database');
  const testDir = join(projectRoot, 'tests', 'e2e');

  const projectFixture = join(projectRoot, 'fixtures', 'test.fixture.ts');
  if (!(await exists(projectFixture))) {
    throw new Error(`Generation blocked: project '${app}' is not initialized with a project fixture. Run npm run project:new -- ${app} first.`);
  }
  const basePage = join(root, 'src/framework/core/ui/base.page.ts');
  const healingOrchestrator = join(root, 'src/framework/healing/healing.orchestrator.ts');
  const baseApiClient = join(root, 'src/framework/api/base-api.client.ts');
  const databaseClient = join(root, 'src/framework/database/database.client.ts');

  const isFeatureReuse = (candidate: ReusableCandidate): boolean => candidate.role === 'feature' && candidate.score >= 0.55;
  const has = (kind: ReusableCandidate['kind']): boolean => reused.some(candidate => candidate.kind === kind && isFeatureReuse(candidate));

  let pagePath: string | undefined;
  let workflowPath: string | undefined;
  let apiPath: string | undefined;
  let dbPath: string | undefined;
  let pageOwned = false;
  let workflowOwned = false;
  let apiOwned = false;
  let dbOwned = false;

  if (analysis.suggestedLayers.includes('UI') && !has('page')) {
    const targetPagePath = join(pageDir, `${feature}.page.ts`);
    pagePath = targetPagePath;
    const result = await materializeProposal(
      targetPagePath,
      pageTemplate(requirement.sourceId, className, pageDir, root, await exists(basePage) && await exists(healingOrchestrator)),
      requirement.sourceId
    );
    pageOwned = result.ownedByRequirement;
    recordMaterialization(created, warnings, 'page', root, targetPagePath, result);
    if (!pageOwned && result.disposition === 'reused-existing') pushUniqueCandidate(reused, exactCandidate('page', root, targetPagePath));
  }

  if (analysis.suggestedLayers.includes('UI') && !has('workflow')) {
    const targetWorkflowPath = join(workflowDir, `${feature}.workflow.ts`);
    workflowPath = targetWorkflowPath;
    const result = await materializeProposal(
      targetWorkflowPath,
      workflowTemplate(requirement.sourceId, className, pageOwned && pagePath ? relImport(workflowDir, pagePath) : undefined),
      requirement.sourceId
    );
    workflowOwned = result.ownedByRequirement;
    recordMaterialization(created, warnings, 'workflow', root, targetWorkflowPath, result);
    if (!workflowOwned && result.disposition === 'reused-existing') pushUniqueCandidate(reused, exactCandidate('workflow', root, targetWorkflowPath));
  }

  if (analysis.suggestedLayers.includes('API') && !has('api-service')) {
    const targetApiPath = join(apiDir, `${feature}.service.ts`);
    apiPath = targetApiPath;
    const result = await materializeProposal(
      targetApiPath,
      apiTemplate(requirement.sourceId, className, apiDir, root, await exists(baseApiClient)),
      requirement.sourceId
    );
    apiOwned = result.ownedByRequirement;
    recordMaterialization(created, warnings, 'api-service', root, targetApiPath, result);
    if (!apiOwned && result.disposition === 'reused-existing') pushUniqueCandidate(reused, exactCandidate('api-service', root, targetApiPath));
  }

  if (analysis.suggestedLayers.includes('DATABASE') && !has('db-repository')) {
    const targetDbPath = join(dbDir, `${feature}.repository.ts`);
    dbPath = targetDbPath;
    const result = await materializeProposal(
      targetDbPath,
      dbTemplate(requirement.sourceId, className, dbDir, root, await exists(databaseClient)),
      requirement.sourceId
    );
    dbOwned = result.ownedByRequirement;
    recordMaterialization(created, warnings, 'db-repository', root, targetDbPath, result);
    if (!dbOwned && result.disposition === 'reused-existing') pushUniqueCandidate(reused, exactCandidate('db-repository', root, targetDbPath));
  }

  const testPath = join(testDir, `${feature}.generated.spec.ts`);
  const testResult = await materializeProposal(
    testPath,
    testTemplate({
      requirementId: requirement.sourceId,
      title: requirement.title,
      scenarios: analysis.suggestedScenarios,
      manualSteps: requirement.manualTestSteps.map(step => step.action),
      layers: analysis.suggestedLayers,
      reused,
      knowledgeEvidence,
      root,
      testDir,
      projectFixture,
      pagePath: pageOwned ? pagePath : undefined,
      workflowPath: workflowOwned ? workflowPath : undefined,
      apiPath: apiOwned ? apiPath : undefined,
      dbPath: dbOwned ? dbPath : undefined,
      className,
      targetApplication: app,
    }),
    requirement.sourceId
  );
  recordMaterialization(created, warnings, 'test', root, testPath, testResult);

  if (reused.length) warnings.push('Reusable candidates were detected inside the resolved application/shared layers. Human reviewer must confirm exact exported APIs/methods; the generator does not invent signatures for human-owned abstractions.');
  if (knowledgeEvidence.length) warnings.push(`Approved application knowledge matched: ${knowledgeEvidence.map(item => item.id).join(', ')}. It is evidence only; generated code still requires human review.`);
  if (pendingKnowledge.length) warnings.push(`Matching learned knowledge is still REVIEW_REQUIRED and was not trusted for generation: ${pendingKnowledge.map(item => item.id).join(', ')}.`);
  if (!knowledgeEvidence.length && analysis.suggestedLayers.some(layer => layer === 'UI' || layer === 'API')) warnings.push('No approved application knowledge matched this requirement. The generator will not invent locators, routes, payloads or endpoints.');
  warnings.push(`Target application '${app}' resolved via ${resolution.source}: ${resolution.reason}`);
  if (analysis.readiness !== 'HIGH') warnings.push(`Automation readiness is ${analysis.readiness}; generated tests remain test.fixme until reviewed.`);
  warnings.push('Generated code never auto-commits or auto-merges. Existing human-owned files are never overwritten by this generator.');

  const manifest: GenerationManifest = {
    requirementId: requirement.sourceId,
    createdAt: new Date().toISOString(),
    reviewRequired: true,
    targetApplication: app,
    layers: analysis.suggestedLayers,
    reused,
    knowledgeEvidence,
    created,
    warnings
  };
  const manifestPath = join(root, 'generated', 'requirements', requirement.sourceId, 'generation-manifest.json');
  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

  const automationProposalPath = join(root, 'generated', 'requirements', requirement.sourceId, 'AUTOMATION_PROPOSAL.md');
  const automationProposal = [
    `# Automation Proposal — ${requirement.title}`,
    '',
    `Author: Raushan Raj`,
    `Requirement: ${requirement.sourceId}`,
    `Target application: ${app}`,
    `Automation layers: ${analysis.suggestedLayers.join(' + ') || 'OTHER'}`,
    '',
    '## Framework contract',
    '- Playwright CLI/MCP/Test Agents may explore and suggest locators.',
    '- Executable UI actions must stay in Page Objects and use LocatorPlan + HealingOrchestrator.',
    '- API routes/payloads/status expectations must come from approved contracts, requirements or observed evidence; never invent an endpoint to make a test pass.',
    '- Database SQL stays in project repositories and is read-only by default during agent authoring; schema names must come from approved evidence.',
    '- Tests use project facades + business-readable test.step(); infrastructure details stay out of business specs.',
    '- UI recovery order is primary -> deterministic fallback -> validated cache -> optional lazy AI fallback.',
    '',
    '## Generated / reused files',
    ...created.map(item => `- ${item.kind}: ${item.path}`),
    ...reused.map(item => `- REUSE ${item.kind}: ${item.path}`),
    '',
    '## Application knowledge',
    ...(knowledgeEvidence.length ? knowledgeEvidence.map(item => `- APPROVED ${item.kind}: ${item.id}`) : ['- No approved knowledge matched; collect layer-appropriate evidence before removing REVIEW_REQUIRED markers.']),
    '',
    '## Next authoring step',
    'Run: npm run test:new -- projects/<project>/requirements/<feature>.md',
    'Then give PLAYWRIGHT_AUTHORING_PROMPT.md to your coding agent. UI uses Playwright CLI/MCP evidence; API/DB use approved contracts/schema evidence and the project facades.',
    ''
  ].join('\n');
  await writeFile(automationProposalPath, automationProposal);

  const changedProposalPaths = created
    .filter(item => item.reason.startsWith('Created missing') || item.reason.startsWith('Explicitly refreshed'))
    .map(item => item.path);
  await initializeProposalReview(root, manifest, changedProposalPaths);

  return { manifest, manifestPath };
}

function pageTemplate(requirementId: string, className: string, pageDir: string, root: string, enterpriseStyle: boolean): string {
  if (enterpriseStyle) {
    const basePageImport = relImport(pageDir, join(root, 'src/framework/core/ui/base.page.ts'));
    const healerImport = relImport(pageDir, join(root, 'src/framework/healing/healing.orchestrator.ts'));
    const typesImport = relImport(pageDir, join(root, 'src/framework/healing/healing.types.ts'));
    return header(requirementId) + `import type { Page } from '@playwright/test';\nimport { BasePage } from '${basePageImport}';\nimport type { HealingOrchestrator } from '${healerImport}';\nimport type { LocatorPlan } from '${typesImport}';\n\nexport class ${className}Page extends BasePage {\n  constructor(page: Page, healer: HealingOrchestrator) { super(page, healer); }\n\n  private readonly primaryActionPlan: LocatorPlan = {\n    id: '${kebab(className)}.primary-action',\n    businessName: '${className} primary action',\n    primary: { type: 'text', value: 'REVIEW_REQUIRED' }\n  };\n\n  /** REVIEW_REQUIRED: replace locator metadata and define the business state that proves the action succeeded. */\n  async performPrimaryAction(): Promise<void> {\n    await this.healingClick(this.primaryActionPlan, {\n      postCondition: {\n        description: 'REVIEW_REQUIRED: describe the expected business/UI state after this action',\n        verify: async () => {\n          throw new Error('REVIEW_REQUIRED: implement semantic post-condition using approved live application evidence.');\n        }\n      }\n    });\n  }\n}\n`;
  }

  return header(requirementId) + `import type { Page } from '@playwright/test';\n\nexport class ${className}Page {\n  constructor(private readonly page: Page) {}\n\n  async performPrimaryAction(): Promise<void> {\n    void this.page;\n    throw new Error('REVIEW_REQUIRED: implement ${className}Page.performPrimaryAction using approved application knowledge.');\n  }\n}\n`;
}

function workflowTemplate(requirementId: string, className: string, pageImport?: string): string {
  return header(requirementId) + (pageImport
    ? `import type { ${className}Page } from '${pageImport}';\n\nexport class ${className}Workflow {\n  constructor(private readonly featurePage: ${className}Page) {}\n  async execute(): Promise<void> { await this.featurePage.performPrimaryAction(); }\n}\n`
    : `import type { Page } from '@playwright/test';\n\nexport class ${className}Workflow {\n  constructor(private readonly page: Page) {}\n  async execute(): Promise<void> {\n    void this.page;\n    throw new Error('REVIEW_REQUIRED: wire the approved existing page/component abstraction.');\n  }\n}\n`);
}

function apiTemplate(requirementId: string, className: string, apiDir: string, root: string, enterpriseStyle: boolean): string {
  if (enterpriseStyle) {
    const baseApiImport = relImport(apiDir, join(root, 'src/framework/api/base-api.client.ts'));
    return header(requirementId) + `import type { BaseApiClient } from '${baseApiImport}';\n\nexport class ${className}Service {\n  constructor(private readonly client: BaseApiClient) {}\n\n  async verifyRequirement(): Promise<void> {\n    void this.client;\n    throw new Error('REVIEW_REQUIRED: map the approved API endpoint, request and deterministic assertions.');\n  }\n}\n`;
  }

  return header(requirementId) + `import type { APIRequestContext } from '@playwright/test';\n\nexport class ${className}Service {\n  constructor(private readonly request: APIRequestContext) {}\n  async verifyRequirement(): Promise<void> {\n    void this.request;\n    throw new Error('REVIEW_REQUIRED: map the approved API endpoint, request and deterministic assertions.');\n  }\n}\n`;
}

function dbTemplate(requirementId: string, className: string, dbDir: string, root: string, enterpriseStyle: boolean): string {
  if (enterpriseStyle) {
    const databaseImport = relImport(dbDir, join(root, 'src/framework/database/database.client.ts'));
    return header(requirementId) + `import type { DatabaseClient } from '${databaseImport}';\n\nexport class ${className}Repository {\n  constructor(private readonly db: DatabaseClient) {}\n\n  async verifyRequirement(): Promise<void> {\n    void this.db;\n    throw new Error('REVIEW_REQUIRED: map approved schema/repository query; do not invent SQL.');\n  }\n}\n`;
  }

  return header(requirementId) + `export class ${className}Repository {\n  async verifyRequirement(): Promise<void> {\n    throw new Error('REVIEW_REQUIRED: map approved schema/repository query; do not invent SQL.');\n  }\n}\n`;
}

interface TestTemplateInput {
  requirementId: string;
  title: string;
  scenarios: string[];
  manualSteps: string[];
  layers: string[];
  reused: ReusableCandidate[];
  knowledgeEvidence: ApplicationKnowledgeMatch[];
  root: string;
  testDir: string;
  projectFixture: string;
  pagePath?: string;
  workflowPath?: string;
  apiPath?: string;
  dbPath?: string;
  className: string;
  targetApplication: string;
}

/**
 * Generated specs intentionally depend only on project domain fixtures. The generator may scaffold
 * Page/Workflow/API/Repository classes, but it never constructs framework internals in a business spec.
 * Human/agent review wires approved scaffolds into App/API/Repository facades before removing fixme.
 */
function testTemplate(input: TestTemplateInput): string {
  const tags = [`@requirement:${input.requirementId}`, `@app:${input.targetApplication}`, '@generated-review', ...input.layers.map(layer => layer === 'DATABASE' ? '@db' : `@${layer.toLowerCase()}`)].join(' ');
  const imports = [`import { test } from '${relImport(input.testDir, input.projectFixture)}';`];
  const fixtureNames = [
    input.layers.includes('UI') ? 'app' : undefined,
    input.layers.includes('API') ? 'api' : undefined,
    input.layers.includes('DATABASE') ? 'repositories' : undefined,
  ].filter((value): value is string => Boolean(value));
  const fixtureArgs = `{ ${fixtureNames.join(', ')} }`;

  const reuseComments = input.reused.length
    ? input.reused.map(candidate => `// REUSE_CANDIDATE ${candidate.role ?? 'supporting'} ${candidate.kind}: ${candidate.path} (score ${candidate.score})`).join('\n')
    : '// No approved reusable abstraction met the threshold; missing project abstractions were scaffolded for review.';
  const knowledgeComments = input.knowledgeEvidence.length
    ? input.knowledgeEvidence.map(item => `// APPROVED_APPLICATION_KNOWLEDGE ${item.kind}: ${item.id} (score ${item.score})`).join('\n')
    : '// No approved application knowledge was used; do not invent application details during review.';
  const scaffoldComments = [
    input.pagePath ? `// SCAFFOLD_PAGE ${relative(input.root, input.pagePath).replace(/\\/g, '/')}` : undefined,
    input.workflowPath ? `// SCAFFOLD_WORKFLOW ${relative(input.root, input.workflowPath).replace(/\\/g, '/')}` : undefined,
    input.apiPath ? `// SCAFFOLD_API ${relative(input.root, input.apiPath).replace(/\\/g, '/')}` : undefined,
    input.dbPath ? `// SCAFFOLD_REPOSITORY ${relative(input.root, input.dbPath).replace(/\\/g, '/')}` : undefined,
  ].filter(Boolean).join('\n');

  const tests = input.scenarios.map((scenario, scenarioIndex) => {
    const steps = scenarioIndex === 0 && input.manualSteps.length ? input.manualSteps : [scenario];
    const fixtureVoids = fixtureNames.length ? `\n  void ${fixtureNames.join('; void ')};\n` : '';
    const stepBlocks = steps.map((step, stepIndex) => `  await test.step(${JSON.stringify(step)}, async () => {\n    // REVIEW_REQUIRED step ${stepIndex + 1}: call the approved project facade/workflow/service/repository method.\n  });`).join('\n\n');
    return `test(${JSON.stringify(`${input.title} - ${scenario} ${tags}`)}, async (${fixtureArgs}) => {\n  test.fixme(true, 'REVIEW_REQUIRED: wire approved project facades using live evidence before execution.');${fixtureVoids}\n${stepBlocks}\n});`;
  }).join('\n\n');

  return header(input.requirementId) + `${imports.join('\n')}\n\n${reuseComments}\n${knowledgeComments}${scaffoldComments ? `\n${scaffoldComments}` : ''}\n\n${tests}\n`;
}

