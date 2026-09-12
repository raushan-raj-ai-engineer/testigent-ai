export interface SecurityException {
  package: string;
  advisoryId: string;
  affectedRange: string;
  rationale: string;
  owner: string;
  expiresAt: string;
}

export interface SecurityExceptionFile {
  schemaVersion: 1;
  exceptions: SecurityException[];
}

export interface NormalizedAdvisory {
  package: string;
  advisoryId: string;
  severity: string;
  affectedRange: string;
  title?: string;
  url?: string;
}

export interface SecurityPolicyResult {
  advisories: NormalizedAdvisory[];
  allowed: Array<NormalizedAdvisory & { exception: SecurityException }>;
  blocking: NormalizedAdvisory[];
}

/** Advisory-specific exception evaluation. A package/version name alone can never suppress a future advisory. */
export function evaluateSecurityAudit(
  audit: any,
  policy: SecurityExceptionFile,
  now = new Date(),
): SecurityPolicyResult {
  validatePolicy(policy);
  const advisories = collectHighCriticalAdvisories(audit);
  const allowed: SecurityPolicyResult['allowed'] = [];
  const blocking: NormalizedAdvisory[] = [];

  for (const advisory of advisories) {
    const exception = policy.exceptions.find(item =>
      item.package === advisory.package
      && item.advisoryId === advisory.advisoryId
      && item.affectedRange === advisory.affectedRange
      && Date.parse(item.expiresAt) > now.getTime()
    );
    if (exception) allowed.push({ ...advisory, exception });
    else blocking.push(advisory);
  }
  return { advisories, allowed, blocking };
}

/** Validates advisory-specific exception records before any exception can affect the security gate. */
export function validatePolicy(policy: SecurityExceptionFile): void {
  if (!policy || policy.schemaVersion !== 1 || !Array.isArray(policy.exceptions)) {
    throw new Error('Security exception policy must have schemaVersion=1 and an exceptions array.');
  }
  const seen = new Set<string>();
  for (const item of policy.exceptions) {
    for (const [field, value] of Object.entries({
      package: item.package,
      advisoryId: item.advisoryId,
      affectedRange: item.affectedRange,
      rationale: item.rationale,
      owner: item.owner,
      expiresAt: item.expiresAt,
    })) {
      if (typeof value !== 'string' || !value.trim()) throw new Error(`Security exception field '${field}' must be non-empty.`);
    }
    if (!Number.isFinite(Date.parse(item.expiresAt))) throw new Error(`Invalid security exception expiry '${item.expiresAt}'.`);
    const key = `${item.package}:${item.advisoryId}:${item.affectedRange}`;
    if (seen.has(key)) throw new Error(`Duplicate security exception '${key}'.`);
    seen.add(key);
  }
}

function collectHighCriticalAdvisories(audit: any): NormalizedAdvisory[] {
  const vulnerabilities = audit?.vulnerabilities ?? {};
  const output = new Map<string, NormalizedAdvisory>();

  const visit = (packageName: string, ancestry: Set<string>): number => {
    if (ancestry.has(packageName)) return 0;
    const nextAncestry = new Set(ancestry);
    nextAncestry.add(packageName);
    const finding = vulnerabilities[packageName];
    if (!finding || !['high', 'critical'].includes(String(finding.severity))) return 0;

    const via = Array.isArray(finding.via) ? finding.via : [];
    let resolved = 0;
    for (const item of via) {
      if (typeof item === 'string') {
        resolved += visit(item, nextAncestry);
        continue;
      }
      if (!item || typeof item !== 'object') continue;
      const advisoryId = String(item.source ?? item.url ?? item.title ?? 'unknown-advisory');
      const affectedRange = String(item.range ?? finding.range ?? 'unknown-range');
      const advisory: NormalizedAdvisory = {
        package: packageName,
        advisoryId,
        severity: String(item.severity ?? finding.severity),
        affectedRange,
        title: typeof item.title === 'string' ? item.title : undefined,
        url: typeof item.url === 'string' ? item.url : undefined,
      };
      output.set(`${advisory.package}:${advisory.advisoryId}:${advisory.affectedRange}`, advisory);
      resolved += 1;
    }

    // Fail closed: npm audit occasionally reports a high/critical package through a dependency name
    // without a concrete advisory object in the payload. Such a chain must never vanish from the gate.
    if (resolved === 0) {
      const advisory: NormalizedAdvisory = {
        package: packageName,
        advisoryId: `unresolved:${packageName}`,
        severity: String(finding.severity),
        affectedRange: String(finding.range ?? 'unknown-range'),
        title: 'npm audit did not expose a concrete high/critical advisory ID',
      };
      output.set(`${advisory.package}:${advisory.advisoryId}:${advisory.affectedRange}`, advisory);
      resolved = 1;
    }
    return resolved;
  };

  for (const [name, finding] of Object.entries(vulnerabilities) as Array<[string, any]>) {
    if (!['high', 'critical'].includes(String(finding?.severity))) continue;
    visit(name, new Set<string>());
  }
  return [...output.values()];
}
