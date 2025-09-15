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

A lightweight tool to guide better 1:1s and track which questions you’ve already covered.

## Quick start

```bash
npm install
npm start
# open http://localhost:3000
```

## How it works (user guide)
- Start a session, give it a name (e.g., "Weekly 1:1 – Alex").
- Next shows a question; Undo goes back; Reset clears progress for that session.
- Export your asked list as Copy/Markdown/CSV if you want a portable record.

## Where your data lives
- Production (Vercel): Your session progress is stored in a small, signed, HttpOnly cookie on your device. The cookie contains only question IDs (not full text) and lasts up to 1 year.
- Local dev (Express server): Sessions are saved to `data/sessions.json` on disk.

Cross‑device sync is not automatic. To move data between devices or browsers, use the export features.

## What can clear your data
- Clearing site data/cookies in your browser
- Private/incognito windows (deleted on close)
- Switching devices/browsers (no shared cookie)
- Local dev only: deleting `data/sessions.json`

## Security
- Cookies are HMAC‑signed (`COOKIE_SECRET`) to prevent tampering, `HttpOnly`, `SameSite=Lax`, and `Secure` in production.
- Set `COOKIE_SECRET` in your deploy environment for proper signing. On Vercel: Project → Settings → Environment Variables → `COOKIE_SECRET`.

## Minimal API
- POST `/api/sessions` → create session → returns `{ id, name, asked: [], skipped: [] }`
- GET `/api/sessions/:id` → returns session state
- PATCH `/api/sessions/:id` with `{ action, question? }` where `action ∈ { markAsked, markSkipped, undoAsked, undoSkipped, reset }`

## Project layout (essentials)
```
.
├── public/                 # UI (HTML/CSS/JS)
├── api/                    # Serverless handlers (cookie‑backed, signed)
│   ├── _utils.js           # parse, cookie sign/verify, logging
│   └── sessions/
│       ├── index.js        # POST /api/sessions
│       └── [id].js         # GET/PATCH /api/sessions/:id
├── server.js               # Local Express server (serves static + file‑backed API)
└── server/sessionStore.js  # File store with per‑session atomic updates
```

## Development notes
- In production, the serverless API stores only IDs in cookies and expands them to full questions at read time.
- The Express store serializes updates per session to avoid lost writes during concurrent requests.
- Run tests with `npm test`.
