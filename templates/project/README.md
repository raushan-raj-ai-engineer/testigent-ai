# __PROJECT__

Project-owned automation only. Reusable engines belong in `src/framework`; do not copy framework utilities into this directory.

Folders:
- `config/` environment endpoints and auth policy
- `fixtures/` project dependency injection
- `requirements/` requirement source files
- `src/pages/` UI mechanics
- `src/workflows/` business journeys
- `src/api/` domain API services
- `src/database/` domain repositories
- `data/` project test data
- `tests/` UI/API/DB/E2E suites


Before handing this project to another team, follow `docs/15-NEW-PROJECT-HANDOFF.md`. For agent-assisted authoring use `npm run test:new -- projects/<project>/requirements/<feature>.md --mode=agents`; do not edit reusable `src/framework` code for project-specific behavior.
