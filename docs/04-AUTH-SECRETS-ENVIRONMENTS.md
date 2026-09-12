# Authentication, Secrets and Environments

Project authentication is configured in `projects/<project>/config/<env>.json`; reusable framework code never owns project credentials, login selectors, endpoints or token keys.

## Recommended v1.3 lifecycle

For a project that supports non-interactive refresh, configure required storage state plus a project-owned provider:

```json
{
  "auth": {
    "strategy": "storageState",
    "storageStatePath": ".auth/project2.qa.json",
    "required": true,
    "verification": {
      "stateKey": { "name": "access_token", "storage": "either" },
      "unauthenticatedControl": { "role": "button", "name": "Login", "exact": true }
    },
    "lifecycle": {
      "autoRefresh": true,
      "providerModule": "auth/auth.provider.ts",
      "verifyBeforeRun": true,
      "refreshSkewMs": 120000,
      "maxRefreshAttempts": 2,
      "runtimeRecovery": "navigation",
      "maxRuntimeRefreshes": 1
    }
  }
}
```

`src/framework/core/auth.manager.ts` owns lifecycle policy: freshness, locking, candidate verification, persistence and safe recovery. `projects/<project>/auth/auth.provider.ts` owns how that application logs in or refreshes a token.

## Normal commands

```bash
APP=<project> ENV=qa npm run auth:check
APP=<project> ENV=qa npm run auth:prepare
APP=<project> ENV=qa npm run test:project -- --project=chromium
```

`test:project` automatically prepares required UI/E2E auth before workers are spawned. API/DB-only lanes remain capability-aware and are not forced to create browser auth state.

When the configured state has a known expiry, TestigentAI refreshes before the expiry safety window. During execution, a known-expiry guard may refresh immediately before framework-owned click/fill actions, while invalid-session recovery is limited to navigation boundaries. Verified refreshed state is hot-applied to the current browser context; mutating actions are never blindly repeated.

## Manual/MFA fallback

For projects that cannot non-interactively refresh, keep lifecycle `autoRefresh` disabled and run:

```bash
npm run qa:auth
```

The interactive capture flow verifies the current session, captures Playwright browser state plus a gitignored sessionStorage companion, proves the capture in a second fresh browser context, and only then promotes it as known-good state.

## Verification is mandatory for required browser auth

A required storage-state project should configure a meaningful verification contract using a state key, authenticated/unauthenticated URL pattern, or authenticated/unauthenticated visible control. File existence alone is not considered proof of authentication.

If authentication cannot be recovered, execution fails as an authentication problem before locator healing. A login-page button must never be interpreted as selector drift.

## Secrets

Never place passwords, refresh tokens, client secrets, API keys, SMTP credentials, database passwords or private session files in committed YAML/JSON. Local secrets belong in `.env`; CI secrets belong in the provider's secret store and are mapped to environment variables only for the jobs that need them.

Common optional provider inputs are:

```text
AUTH_USERNAME
AUTH_PASSWORD
AUTH_CLIENT_ID
AUTH_CLIENT_SECRET
AUTH_REFRESH_TOKEN
```

Projects may use different names when required by their identity platform. The reusable framework does not require a particular authentication vendor.

Generated `.auth/` state and lifecycle metadata are gitignored because they may contain impersonation-capable browser state. Do not publish them as ordinary CI artifacts.

Environment files remain project-owned. Add `uat.json`, `stage.json`, etc. under the project rather than creating global application maps.

For the architecture, concurrency model, CI guidance and provider template, read `docs/28-AUTH-LIFECYCLE-AUTO-REFRESH.md`.
