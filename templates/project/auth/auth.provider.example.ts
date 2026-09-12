import type { ProjectAuthProvider } from '../../../src/framework/core/auth.provider';

/**
 * Example project-owned auth provider. Copy/rename to auth.provider.ts, implement the application's login/refresh flow,
 * and reference it from auth.lifecycle.providerModule. Read credentials only from local/CI secrets.
 */
export const authProvider: ProjectAuthProvider = {
  id: 'project-auth-provider',
  async refresh(context) {
    const username = required('AUTH_USERNAME');
    const password = required('AUTH_PASSWORD');
    void username;
    void password;
    void context;

    throw new Error(
      'Implement project auth here (API login/OIDC refresh/UI bootstrap) and return verified browser storage state. ' +
      'Do not put credentials or project login selectors in src/framework.',
    );
  },
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required by this project auth provider.`);
  return value;
}
