import fs from 'node:fs';

/** Shared database TLS policy. Certificate verification is mandatory by default whenever TLS is enabled. */
export interface DatabaseTlsPolicy {
  enabled: boolean;
  rejectUnauthorized: boolean;
  ca?: string;
}

export function resolveDatabaseTlsPolicy(env: NodeJS.ProcessEnv = process.env): DatabaseTlsPolicy {
  const mode = (env.DB_SSL ?? '').trim().toLowerCase();
  const enabled = ['true', '1', 'required', 'verify-ca', 'verify-full'].includes(mode);
  if (!enabled) return { enabled: false, rejectUnauthorized: true };

  const allowInsecure = (env.DB_TLS_ALLOW_INSECURE ?? '').trim().toLowerCase() === 'true';
  const protectedRuntime = (env.CI ?? '').toLowerCase() === 'true'
    || (env.NODE_ENV ?? '').toLowerCase() === 'production'
    || (env.DB_TLS_STRICT ?? '').toLowerCase() === 'true';
  if (allowInsecure && protectedRuntime) {
    throw new Error('DB_TLS_POLICY: certificate verification cannot be disabled in CI, production, or strict mode.');
  }

  const ca = readConfiguredCa(env);
  return {
    enabled: true,
    rejectUnauthorized: !allowInsecure,
    ...(ca ? { ca } : {}),
  };
}

function readConfiguredCa(env: NodeJS.ProcessEnv): string | undefined {
  const inline = env.DB_CA?.trim();
  if (inline) return inline;
  const file = env.DB_CA_FILE?.trim();
  if (!file) return undefined;
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error(`DB_TLS_CA_FILE: configured CA file does not exist: ${file}`);
  return fs.readFileSync(file, 'utf8');
}
