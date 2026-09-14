import fs from 'node:fs';

/** Shared database TLS policy. Certificate verification is mandatory whenever TLS is enabled. */
export interface DatabaseTlsPolicy {
  enabled: boolean;
  rejectUnauthorized: boolean;
  ca?: string;
}

const TLS_ENABLED = new Set(['true', '1', 'on', 'require', 'required', 'verify-ca', 'verify-full']);
const TLS_DISABLED = new Set(['false', '0', 'off', 'disable', 'disabled']);

/**
 * Resolves the effective database TLS policy from runtime configuration.
 * Enforces encryption and certificate verification in strict, production, and protected CI contexts,
 * while allowing explicitly configured local-development behavior where policy permits it.
 */
export function resolveDatabaseTlsPolicy(env: NodeJS.ProcessEnv = process.env): DatabaseTlsPolicy {
  const rawMode = (env.DB_SSL ?? '').trim().toLowerCase();
  if (rawMode && !TLS_ENABLED.has(rawMode) && !TLS_DISABLED.has(rawMode)) throw new Error(`DB_TLS_POLICY: unsupported DB_SSL mode '${env.DB_SSL}'.`);

  const strict = truthy(env.DB_TLS_STRICT);
  const ci = truthy(env.CI);
  const production = (env.NODE_ENV ?? '').trim().toLowerCase() === 'production';
  const databaseConfigured = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PORT'].some(key => Boolean(env[key]?.trim()));
  const explicitlyDisabled = TLS_DISABLED.has(rawMode);
  const enabled = TLS_ENABLED.has(rawMode);
  const encryptionRequired = strict || production || (ci && (databaseConfigured || rawMode !== ''));

  if (encryptionRequired && !enabled) {
    const reason = strict ? 'strict mode' : production ? 'production' : 'configured CI database';
    throw new Error(`DB_TLS_POLICY: TLS encryption is required in ${reason}; DB_SSL must be an enabled mode.`);
  }
  if (!enabled) {
    if (explicitlyDisabled || rawMode === '') return { enabled: false, rejectUnauthorized: true };
    throw new Error('DB_TLS_POLICY: unable to determine TLS mode.');
  }

  const allowInsecureRaw = (env.DB_TLS_ALLOW_INSECURE ?? '').trim().toLowerCase();
  if (allowInsecureRaw && !['true', 'false', '1', '0', 'on', 'off'].includes(allowInsecureRaw)) throw new Error(`DB_TLS_POLICY: unsupported DB_TLS_ALLOW_INSECURE value '${env.DB_TLS_ALLOW_INSECURE}'.`);
  const allowInsecure = truthy(env.DB_TLS_ALLOW_INSECURE);
  if (allowInsecure && (ci || production || strict)) throw new Error('DB_TLS_POLICY: certificate verification cannot be disabled in CI, production, or strict mode.');

  const ca = readConfiguredCa(env);
  return { enabled: true, rejectUnauthorized: !allowInsecure, ...(ca ? { ca } : {}) };
}

function truthy(value: string | undefined): boolean { return ['true', '1', 'on', 'yes'].includes((value ?? '').trim().toLowerCase()); }
function readConfiguredCa(env: NodeJS.ProcessEnv): string | undefined {
  const inline = env.DB_CA?.trim();
  if (inline) return inline;
  const file = env.DB_CA_FILE?.trim();
  if (!file) return undefined;
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error(`DB_TLS_CA_FILE: configured CA file does not exist: ${file}`);
  return fs.readFileSync(file, 'utf8');
}
