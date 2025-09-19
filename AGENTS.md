# AI Agent Guide

## Project overview
- Simple Express server serving a static UI with a small API for sessions.
- UI lives in `public/`. Serverless-style API in `api/`. Local dev server in `server.js`.
- Tests run with Jest (`__tests__/`).

## Run and test
- Install: `npm install`
- Start: `npm start` then open http://localhost:3000
- Test: `npm test`

## Code quality and maintainability
- Keep changes small, cohesive, and readable.
- Preserve existing file indentation, style, and patterns. Do not reformat unrelated code.
- Avoid introducing dependencies unless essential. If required, explain and justify.
- Cover edge cases and error paths; prefer pure functions where feasible.
- Do not commit changes to `data/sessions.json` (local dev data).

## Testing policy
- Add/adjust Jest tests under `__tests__/` for changed behavior.
- Prefer unit tests for logic; integration tests when endpoints/UI flows change.
- Ensure tests pass locally (`npm test`) before proposing commits.

## Commits
- Use Conventional Commits (e.g., `feat: ...`, `fix: ...`, `refactor: ...`, `test: ...`, `docs: ...`).
- One logical change per commit; include context in body if needed.
- Never include local data changes (e.g., `data/sessions.json`) in commits.

## Functional/UI verification
- Every task must conclude with a verifiable outcome:
  - Exact steps to run locally.
  - UI or API behavior to check (selectors/URLs).
  - Expected result.
  - Any screenshots/gifs if relevant (optional).

## Required response template (for every task)
- What changed
- How to run
- Tests
  - Added/updated tests
  - Local run result (jest summary)
- UI/Functional verification checklist
- Suggested commit message (Conventional Commits)
- Follow-ups (if any)


