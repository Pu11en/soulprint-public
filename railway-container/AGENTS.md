# AGENTS.md

This file defines conventions for editing the server in this repository.

## Scope

- Applies to `src/server.js` and everything under `src/server/`.
- `src/server.js` is the composition/bootstrap entrypoint.
- Domain behavior lives in focused modules under `src/server/`.

## Server Architecture

- Keep `src/server.js` thin:
  - Create app/proxy/server
  - Wire shared services
  - Register routes
  - Start server
- Keep business logic out of `src/server.js`.
- Use route registrars in `src/server/routes/` with injected dependencies.

## Route Module Pattern

- Use `registerXRoutes({ app, ...deps })`.
- Route modules should not import global mutable state from other route modules.
- Pass dependencies explicitly (for example `clawCmd`, `shellCmd`, `gatewayEnv`, `isOnboarded`).
- Preserve existing route paths and response shapes unless explicitly requested.

## Module Boundaries

- `constants.js`: constants and config enums/maps.
- `helpers.js`: stateless helpers/parsers/formatters.
- `env.js`: `.env` read/write/reload and env watcher.
- `gateway.js`: gateway lifecycle and channel sync/proxy config.
- `commands.js`: CLI execution wrappers (`shellCmd`, `clawCmd`, `gogCmd`).
- `auth-profiles.js`: Codex auth profile persistence.
- `login-throttle.js`: in-memory login rate-limit state and logic.
- `openclaw-version.js`: version cache + update flow.
- `routes/*.js`: HTTP route handlers only.

## State And Side Effects

- Keep stateful caches/maps in module closures where they are used.
- Centralize shell/CLI execution through `commands.js`.
- Avoid duplicating env mutation logic; use `env.js` helpers.
- Avoid writing gateway config from multiple places unless required.

## Conventions

- Keep CommonJS (`require` / `module.exports`) in server code.
- Prefer small pure helpers over large inline blocks.
- Keep existing comments; do not remove them without request.
- Global constant naming uses `kName` format (for example `kTrustProxyHops`).
- Keep changes incremental and behavior-preserving by default.

## Change Safety Checklist

- Do not change auth middleware order unless intentional.
- Do not change proxy route precedence unless intentional.
- Do not change onboarding flow semantics unless requested.
- Validate edits with at least:
  - `node --check src/server.js`
  - `node --check src/server/**/*.js` (or equivalent per-file checks)

## Tests

- Add/update targeted tests for touched modules under `tests/server/`.
- Prefer narrow unit tests for helpers/services and small route tests for handlers.
- When changing any server API route (`/api/*`) behavior, update existing API tests in the same change.
- When adding a new server API route or new branch/error path, add new tests that cover:
  - success response shape
  - validation/error response shape
  - dependency failure handling (when applicable)
- Do not merge server API changes without corresponding test updates unless explicitly approved.

## Git Push Discipline

- Before pushing any branch, run tests locally and confirm they pass:
  - `npm test`
- If tests fail, fix or revert the related change before pushing.
- Do not push code that changes server/API behavior without updated tests in the same branch.
- Before opening or merging a PR, ensure GitHub Actions test checks are green.
