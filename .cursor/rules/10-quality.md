---
name: Code Quality and Maintainability
---

- Keep edits minimal and localized; avoid drive-by refactors.
- Preserve existing indentation and formatting style; do not reformat entire files.
- Prefer simple, explicit code; avoid cleverness.
- Add input validation and error handling on server endpoints (`api/**`, `server/**`).
- Document non-obvious decisions in code comments next to the change (not as narration).
- Do not add new dependencies unless essential; justify when you do.
- Do not commit changes to `data/sessions.json`.


