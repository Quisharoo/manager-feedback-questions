const express = require('express');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- minimal file-backed session store ---
function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(SESSIONS_FILE)) {
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify({ sessions: {} }, null, 2));
  }
}

function readSessions() {
  ensureDataFile();
  const raw = fs.readFileSync(SESSIONS_FILE, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (e) {
    return { sessions: {} };
  }
}

function writeSessions(store) {
  ensureDataFile();
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(store, null, 2));
}

function createSession(name) {
  const id = randomUUID();
  const session = { id, name, asked: [], skipped: [] };
  const store = readSessions();
  store.sessions[id] = session;
  writeSessions(store);
  return session;
}

function getSession(id) {
  const store = readSessions();
  return store.sessions[id] || null;
}

function saveSession(session) {
  const store = readSessions();
  store.sessions[session.id] = session;
  writeSessions(store);
}

// --- API ---
app.post('/api/sessions', (req, res) => {
  const name = (req.body && typeof req.body.name === 'string' && req.body.name.trim()) || null;
  const session = createSession(name || '');
  res.status(201).json(session);
});

app.get('/api/sessions/:id', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Not found' });
  res.json(session);
});

// PATCH body: { action, question }
// actions: markAsked, markSkipped, undoAsked, undoSkipped, reset
app.patch('/api/sessions/:id', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Not found' });
  const action = req.body && req.body.action;
  const question = req.body && req.body.question; // { theme, text }

  switch (action) {
    case 'markAsked':
      if (question && question.text) {
        session.asked.push(question);
        // If it was skipped earlier, remove the last matching skipped
        const idx = session.skipped.findIndex(q => q.text === question.text);
        if (idx !== -1) session.skipped.splice(idx, 1);
      }
      break;
    case 'markSkipped':
      if (question && question.text) {
        session.skipped.push(question);
        const idx = session.asked.findIndex(q => q.text === question.text);
        if (idx !== -1) session.asked.splice(idx, 1);
      }
      break;
    case 'undoAsked':
      session.asked.pop();
      break;
    case 'undoSkipped':
      session.skipped.pop();
      break;
    case 'reset':
      session.asked = [];
      session.skipped = [];
      break;
    default:
      return res.status(400).json({ error: 'Invalid action' });
  }

  saveSession(session);
  res.json(session);
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
