---
name: Tests First
---

- For any behavior change, create or update Jest tests under `__tests__/`.
- Run `npm test` locally before concluding the task; include a brief summary of results.
- Favor unit tests for logic (e.g., helpers in `public/**` or `api/_utils.js`), and integration tests when endpoints or UI flows change.
- Avoid brittle tests (no timing sleeps if possible; use deterministic inputs).


