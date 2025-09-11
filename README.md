---
title: manager-feedback-questions
emoji: 🐳
colorFrom: gray
colorTo: blue
sdk: static
pinned: false
tags:
  - deepsite
---

This project now includes a simple Express server for local development.

## Setup

Install dependencies:

```bash
npm install
```

Run the server:

```bash
npm start
```

Then open <http://localhost:3000> in your browser.

Check out the configuration reference at <https://huggingface.co/docs/hub/spaces-config-reference>

## API

### POST `/api/sessions`

Creates a new session.

- Request: `Content-Type: application/json`
  - Body: `{ "name": string }` (required, non-empty after trim)
- Response: `201 Created`
  - JSON: `{ id: string, name: string, asked: [], skipped: [] }`
- Errors:
  - `400 Bad Request` → `{ error: "Invalid name" }`
  - `405 Method Not Allowed` for non-POST

Storage: In serverless environments (e.g., Vercel), session state is stored in an `HttpOnly` cookie, keyed per-session (`mfq_s_<id>`). On create, the cookie is set with `SameSite=Lax` and a 1-year `Max-Age`. No in-memory state is required between requests.

### GET `/api/sessions/:id`

Reads session state.

- Requires the corresponding `mfq_s_<id>` cookie to be present on the request.
- Response: `200 OK` with the full session JSON; `404 Not Found` if missing/invalid.

### PATCH `/api/sessions/:id`

Updates session progress.

- Request: `Content-Type: application/json`
  - Body: `{ action: 'markAsked'|'markSkipped'|'undoAsked'|'undoSkipped'|'reset', question?: { theme: string, text: string } }`
- Response: `200 OK` with updated session JSON; `400` on invalid action; `404` if no session cookie for that `id`.

### Client usage

The client calls the API using `fetch` with JSON bodies, and surfaces non-OK responses via `console.error` and a user-friendly alert for session creation.

### Notes

- Minimal structured logging is emitted from API handlers with method, URL, and select headers for diagnostics. Secrets are not logged.
- In production, consider replacing Tailwind CDN with a static build and remove any unsupported `Permissions-Policy` directives.

## Keyboard shortcuts

- N: Next question
- U: Undo last asked
- R: Reset session (opens confirm sheet)
- Enter (Existing tab): Open selected session
- Esc (New tab): Cancel create form

## Export formats

- Copy list: Newline-separated questions
- Export Markdown: `asked-<session>.md` with a numbered list and header `# Asked: <name> (<YYYY-MM-DD>)`
- Export CSV: `asked-<session>.csv` columns: index, question, timestamp (ms)
