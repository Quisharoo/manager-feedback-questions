A lightweight tool to guide better 1:1s and track which questions you've already covered.

## Quick start

```bash
npm install
npm start
# open http://localhost:3000
```

## How it works
- Start a session, give it a name (e.g., "Weekly 1:1 – Alex")
- Next shows a question; add notes, then mark asked or skip
- Export your asked list as Markdown/CSV for records
- Create shareable links for remote storage and multi-device access

## Storage options
- **Local mode**: Sessions stored in browser localStorage (default)
- **Server mode**: Shareable sessions with capability-based URLs (edit/view keys)
- **Production**: Supports Vercel KV or Upstash Redis for serverless deployments

## Environment variables
Copy `.env.example` to `.env` for local development. Key variables:

- `COOKIE_SECRET` – Signs cookies/keys (required in production)
- `ADMIN_KEY` – Optional: restricts session creation to admin
- `KV_REST_API_URL`, `KV_REST_API_TOKEN` – Vercel KV storage
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` – Upstash Redis storage

## API endpoints
**Regular sessions** (optional admin key):
- POST `/api/sessions` → create
- GET/PATCH `/api/sessions/:id`

**Capability sessions** (always key-gated):
- POST `/api/capsessions` → create with shareable links
- GET/PATCH `/api/capsessions/:id?key=...`

Actions: `markAsked`, `markSkipped`, `undoAsked`, `undoSkipped`, `reset`, `setAnswer`, `setCurrentQuestion`

## Project structure
```
.
├── public/           # Vanilla JS frontend
├── api/              # Serverless API handlers
│   ├── _crypto.js    # Shared crypto utilities
│   ├── _store.js     # Storage abstraction (KV/file)
│   ├── _utils.js     # Cookie signing, parsing
│   ├── sessions/     # Regular session endpoints
│   ├── capsessions/  # Capability session endpoints
│   └── admin/        # Admin endpoints
├── server.js         # Express dev server
└── server/           # File-based storage for local dev
```

## Development
```bash
npm test              # Run test suite
npm start             # Start dev server on :3000
```
