import type { GenerationProposal } from '../contracts/generation.types.js';
import type { AgentEvidenceReference } from '../contracts/agent.types.js';
import type { AgenticReviewResult, ReviewFinding, ReviewFindingSeverity } from '../contracts/review.types.js';

const RULES: Array<{ id: string; severity: ReviewFindingSeverity; pattern: RegExp; message: string }> = [
  { id: 'literal-secret', severity: 'critical', pattern: /\b(?:password|token|apiKey|secret|clientSecret)\s*[:=]\s*['"][^'"\n]+['"]/i, message: 'Hard-coded credential-like value detected.' },
  { id: 'private-key', severity: 'critical', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, message: 'Private key material detected.' },
  { id: 'absolute-url', severity: 'error', pattern: /https?:\/\//i, message: 'Absolute URL detected; environment-dependent URLs belong in project configuration.' },
  { id: 'raw-playwright-ui', severity: 'error', pattern: /\bpage\.(?:goto|locator|getByRole|getByText|getByLabel|getByPlaceholder|getByTestId|click|fill|press|check|uncheck|selectOption)\s*\(/, message: 'Raw Playwright UI action bypasses the project authoring abstraction.' },
  { id: 'direct-healer', severity: 'error', pattern: /new\s+HealingOrchestrator\s*\(/, message: 'Generated test directly constructs HealingOrchestrator.' },
  { id: 'direct-ai-gateway', severity: 'error', pattern: /createAiGateway\s*\(/, message: 'Generated test directly constructs the AI gateway.' },
  { id: 'direct-api-client', severity: 'error', pattern: /new\s+BaseApiClient\s*\(/, message: 'Generated test directly constructs BaseApiClient.' },
  { id: 'runtime-target-env', severity: 'error', pattern: /process\.env\.(?:APP|ENV)\b/, message: 'Generated test reads APP/ENV directly instead of project/runtime configuration.' },
  { id: 'database-secret-env', severity: 'error', pattern: /process\.env\.DB_(?:TYPE|HOST|PORT|NAME|USER|PASSWORD|SSL)\b/, message: 'Generated test directly reads database environment configuration.' },
];

function finding(ruleId: string, severity: ReviewFindingSeverity, message: string, proposal: GenerationProposal): ReviewFinding {
  const evidence: AgentEvidenceReference[] = [{ kind: 'source', ref: proposal.targetPath, digest: proposal.contentSha256 }];
  return { ruleId, severity, message, evidence };
}

/** Performs deterministic architecture/security review over generated agentic source before any promotion is allowed. */
export function reviewGenerationProposal(proposal: GenerationProposal): AgenticReviewResult {
  const findings: ReviewFinding[] = [];
  if (proposal.duplicateDetected) findings.push(finding('duplicate-proposal', 'error', 'Proposal duplicates an existing target or equivalent project artifact.', proposal));
  const normalizedTarget = proposal.targetPath.replaceAll('\\', '/');
  const segments = normalizedTarget.split('/');
  if (segments.some(segment => !segment || segment === '.' || segment === '..') || !normalizedTarget.startsWith(`projects/${proposal.project}/`)) {
    findings.push(finding('project-boundary', 'critical', 'Target path escapes or ambiguously traverses the selected project boundary.', proposal));
  }
  const referencedProjects = [...proposal.content.matchAll(/projects\/([A-Za-z0-9._-]+)\//g)].map(match => match[1]);
  if (referencedProjects.some(project => project !== proposal.project)) findings.push(finding('cross-project-reference', 'error', 'Generated content references another project boundary.', proposal));
  for (const rule of RULES) if (rule.pattern.test(proposal.content)) findings.push(finding(rule.id, rule.severity, rule.message, proposal));
  if (proposal.kind === 'test') {
    if (!/@requirement:/.test(proposal.content)) findings.push(finding('requirement-tag', 'warning', 'Generated test does not include an explicit @requirement tag.', proposal));
    if (!/\btest(?:\.describe|\()/.test(proposal.content)) findings.push(finding('playwright-test-contract', 'error', 'Generated test artifact does not contain a Playwright test contract.', proposal));
    if (!/\bexpect\s*\(/.test(proposal.content)) findings.push(finding('deterministic-assertion', 'warning', 'Generated test contains no direct deterministic expect() assertion.', proposal));
  }
  const blocking = findings.filter(item => item.severity === 'critical' || item.severity === 'error');
  const deterministicValidationPassed = blocking.length === 0;
  return {
    version: 1,
    proposalId: proposal.id,
    state: deterministicValidationPassed ? 'REVIEW_REQUIRED' : 'REJECTED',
    deterministicValidationPassed,
    requiresHumanApproval: true,
    findings,
    rationale: deterministicValidationPassed
      ? 'Deterministic checks passed. Human approval remains mandatory before source promotion.'
      : `${blocking.length} blocking deterministic review finding(s) prevent promotion.`,
  };
}
