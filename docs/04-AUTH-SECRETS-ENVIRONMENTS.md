# Authentication, Secrets and Environments

Project authentication is configured in `projects/<project>/config/<env>.json`; reusable framework code never owns project credentials or login selectors.

```json
{
  "auth": {
    "strategy": "storageState",
    "storageStatePath": ".auth/project2.qa.json",
    "required": true,
    "verification": {
      "unauthenticatedControl": {
        "role": "button",
        "name": "Login",
        "exact": true
      },
      "timeoutMs": 2500
    }
  }
}
```

`verification` is required for projects whose storage state is required. A project may configure an authenticated or unauthenticated URL pattern/control. This keeps application-specific login knowledge in project configuration instead of reusable framework code.

Create/refresh state through the thin developer command:

```bash
npm run qa:auth
```

`qa:auth` is deliberately stricter than a normal storage-state capture:

1. open a clean interactive browser context;
2. let the engineer complete login;
3. verify the current page against the project auth contract;
4. capture Playwright cookies/localStorage plus a gitignored sessionStorage companion;
5. restore both into a second fresh browser context;
6. revisit the application and verify authentication again;
7. only then promote the new auth files as the local known-good state.

If a fresh context still shows the configured unauthenticated marker, auth capture fails and the previous known-good auth state is not replaced. This prevents an empty/invalid `.auth` file from making `qa:doctor` look healthy.

Normal UI execution restores the Playwright storage state through `playwright.config.ts` and restores the optional sessionStorage companion through the reusable enterprise fixture. Authenticated `BasePage.navigate()` calls verify the configured auth contract immediately after navigation. An expired/missing session therefore fails as `AUTH_SESSION_INVALID` before locator healing starts; login-page controls are never treated as locator drift.

The generated auth files may contain cookies/tokens and are ignored by Git. For mutating parallel suites, prefer separate test accounts or per-worker authentication rather than sharing one mutable account.

Never place passwords, SMTP credentials, API tokens, database passwords, or connector tokens in committed YAML or JSON. Local secrets belong in `.env`; CI secrets belong in the CI provider’s secret store and should be mapped to environment variables.

Environment files are project-owned. Add `uat.json`, `stage.json`, etc. under the project rather than creating global application maps.
