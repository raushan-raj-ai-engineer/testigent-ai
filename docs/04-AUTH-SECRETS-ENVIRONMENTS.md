# Authentication, Secrets and Environments

Project auth is configured in `projects/<project>/config/<env>.json`.

```json
{
  "auth": {
    "strategy": "storageState",
    "storageStatePath": ".auth/project2.qa.json",
    "required": true
  }
}
```

Create state interactively only when explicitly enabled:

```bash
APP=project2 ENV=qa APPLICATION_EXPLORATION_ENABLED=true npm run app:auth
```

The generated auth file may contain cookies/tokens and is ignored by Git. For mutating parallel suites, prefer separate test accounts or per-worker authentication rather than sharing one mutable account.

Never place passwords, SMTP credentials, API tokens, database passwords, or connector tokens in committed YAML or JSON. Local secrets belong in `.env`; CI secrets belong in the CI provider’s secret store and should be mapped to environment variables.

Environment files are project-owned. Add `uat.json`, `stage.json`, etc. under the project rather than creating global application maps.
