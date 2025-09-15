const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

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

// Simple per-session promise chain to serialize read-modify-write operations
const updateLocks = new Map();
function updateSession(id, updater) {
  const last = updateLocks.get(id) || Promise.resolve();
  const next = last.then(() => {
    const store = readSessions();
    const current = store.sessions[id] || null;
    const updated = updater(current);
    if (updated) {
      store.sessions[id] = updated;
      writeSessions(store);
    }
    return updated;
  }).catch((e) => { throw e; });
  // cleanup after completion
  updateLocks.set(id, next.finally(() => {
    if (updateLocks.get(id) === next) updateLocks.delete(id);
  }));
  return next;
}

module.exports = {
  createSession,
  getSession,
  saveSession,
  updateSession,
};


