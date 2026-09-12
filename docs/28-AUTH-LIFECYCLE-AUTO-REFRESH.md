# Generic Authentication Lifecycle and Auto Refresh

## Goal

Authentication is a framework lifecycle concern, but login mechanics are application concerns. Introduced in TestigentAI v1.3.0, the lifecycle separates **when auth must be checked/refreshed** from **how a project obtains credentials/tokens**.

Reusable code lives under `src/framework/core/auth.*`. Application-specific login/refresh logic lives under `projects/<project>/auth/`. This supports API login, OAuth/OIDC token acquisition, cookie sessions, localStorage/sessionStorage tokens, refresh-token flows, SSO helper services and other project-specific mechanisms without putting selectors, endpoints or credentials in framework core.

## v1.3.1 regression note

The bundled `sdet-practice` demo provider now uses the live demo identity casing `admin@test.com` and is covered by `tests/framework/sdet-auth-provider.contract.spec.ts`. That contract runs against a local HTTP server, so credential-form and storage-state regressions are caught without depending on the external SUT.

## Runtime flow

```text
npm run test:project
        |
        v
resolve project + environment + execution lane
        |
        v
UI/E2E requires browser auth?
   no --------> start Playwright
   yes
        |
        v
AuthManager.prepareForRun()
        |
        +--> missing / near expiry / verification failed?
        |        |
        |        v
        |   acquire single-flight file lock
        |        |
        |        v
        |   project auth provider refresh()
        |        |
        |        v
        |   write candidate state
        |        |
        |        v
        |   verify candidate in fresh browser context
        |        |
        |        v
        |   atomically promote verified state + metadata
        |
        v
start Playwright workers using one verified state on that runner
        |
        +--> before framework-owned click/fill: known expiry inside safety window?
        |        |
        |        v
        |   refresh + hot-apply state BEFORE action
        |   (the action itself is not replayed)
        |
        v
BasePage navigation safe boundary
        |
        +--> near known expiry OR auth verification failed?
                 |
                 v
            bounded runtime refresh
                 |
                 v
            BrowserContext.setStorageState()
            + explicit localStorage/sessionStorage apply
                 |
                 v
            replay navigation only + verify
```

Mutating operations are **not** automatically replayed. A cheap known-expiry guard may refresh immediately *before* a framework-owned Create/Update/Delete/Pay/Submit action begins. If authentication becomes invalid after the action has already started, the framework fails visibly rather than blindly retrying and risking a duplicate business transaction. Invalid-session replay is restricted to navigation boundaries.

## Project configuration

```json
{
  "auth": {
    "strategy": "storageState",
    "storageStatePath": ".auth/my-app.qa.json",
    "required": true,
    "verification": {
      "stateKey": {
        "name": "access_token",
        "storage": "either"
      },
      "unauthenticatedControl": {
        "role": "button",
        "name": "Login",
        "exact": true
      }
    },
    "lifecycle": {
      "autoRefresh": true,
      "providerModule": "auth/auth.provider.ts",
      "verifyBeforeRun": true,
      "refreshSkewMs": 120000,
      "maxRefreshAttempts": 2,
      "runtimeRecovery": "navigation",
      "maxRuntimeRefreshes": 1,
      "lockTimeoutMs": 30000,
      "lockStaleMs": 120000
    }
  }
}
```

`refreshSkewMs` should be long enough to avoid entering a business step with a token about to expire, but not so long that every short run refreshes unnecessarily. Two minutes is a conservative default for short-lived web tokens.

## Project provider

Copy `templates/project/auth/auth.provider.example.ts` into `projects/<project>/auth/auth.provider.ts` and implement only the project-specific authentication mechanics.

```ts
import type { ProjectAuthProvider } from '../../../src/framework/core/auth.provider';

export const authProvider: ProjectAuthProvider = {
  id: 'my-app-api-login',
  async refresh(context) {
    // Read secrets from environment / secret manager.
    // Call the application's approved auth endpoint or refresh-token flow.
    // Return Playwright storage state plus optional sessionStorage and expiry.
    return {
      storageState: { cookies: [], origins: [] },
      expiresAt: Date.now() + 30 * 60_000,
    };
  },
};
```

The provider must not log credentials or access/refresh tokens. The framework logs only safe application/environment/provider labels and expiry timestamps.

## Local usage

```bash
npm run qa:use -- <project> qa
npm run auth:check
npm run auth:prepare
npm run qa:test -- --project=chromium
```

Normally `qa:test` / `test:project` calls the same preparation automatically. `auth:prepare` is useful for diagnosis or warming auth before a longer local run. If the application uses MFA or a flow that cannot be non-interactively refreshed, keep `autoRefresh` off and use `npm run qa:auth` for governed interactive capture.

## CI usage

CI sets `APP` and `ENV`, installs the project, then runs `npm run test:project`. No committed storage-state file is required when that project's lifecycle has `autoRefresh: true` and its provider has the required CI secrets.

Recommended secret names for simple providers are `AUTH_USERNAME`, `AUTH_PASSWORD`, `AUTH_CLIENT_ID`, `AUTH_CLIENT_SECRET` and `AUTH_REFRESH_TOKEN`. A project provider may use different secret names when required by its identity platform. Store them only in GitHub Actions Secrets, Azure protected variables/Key Vault, or an equivalent secret manager.

The bundled `sdet-practice` example uses the public demo identity `admin@test.com` only as a fallback demonstration. Set `AUTH_USERNAME` and `AUTH_PASSWORD` in local/CI secret configuration whenever the target deployment differs; environment values always override the example fallback.

Avoid passing `.auth` files between unrelated CI jobs unless your organization explicitly approves that secret-bearing artifact flow. A short non-interactive provider refresh in each isolated CI runner is usually safer than uploading reusable browser state as a build artifact.

## Concurrency and performance

Within one runner, preparation occurs before Playwright workers fan out. A file lock also prevents parallel processes on that runner from refreshing the same state simultaneously. A waiter reuses state refreshed by the lock owner. The lock file contains only PID/timestamp metadata, never credentials or tokens.

For very large distributed CI, prefer an identity-provider-safe refresh flow or dedicated test identities rather than sharing one mutable user session across machines.

## State integrity

Refresh output is first written to candidate files. TestigentAI starts a fresh Chromium context, restores candidate browser/session state, navigates to the configured application URL and applies the project verification contract. Only a verified candidate replaces the prior state. JSON state writes and metadata writes use temporary files plus replace/copy fallback for cross-platform safety.

Known JWT expiry is used only as a scheduling hint. A decoded `exp` claim is not treated as proof that a token is authentic; browser verification remains the correctness gate.

## Security rules

- `.auth/` remains gitignored because browser state can impersonate a user.
- Never commit private usernames/passwords, refresh tokens, client secrets or session files.
- Use least-privilege test accounts and separate identities when parallel tests mutate shared user data.
- Bound refresh attempts and runtime recoveries to avoid infinite login loops.
- Keep project login endpoints/selectors/token keys outside reusable framework core.
