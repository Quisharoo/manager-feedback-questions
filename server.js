const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { createSession, getSession, saveSession, updateSession } = require('./server/sessionStore');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Capability key helpers ---
const ADMIN_KEY = process.env.ADMIN_KEY || '';
const HMAC_SECRET = process.env.COOKIE_SECRET || 'dev-secret';
function genKey(bits = 192) { return crypto.randomBytes(bits / 8).toString('base64url'); }
function hashKey(key) { return crypto.createHmac('sha256', HMAC_SECRET).update(String(key || '')) .digest('base64'); }
function extractKey(req) {
  const q = req.query && req.query.key;
  const auth = req.headers && req.headers.authorization;
  const m = auth && auth.match(/^Key\s+(.+)$/i);
  return q || (m && m[1]) || '';
}
function isAdmin(req) {
  if (!ADMIN_KEY) return false;
  const k = extractKey(req);
  try {
    const a = Buffer.from(hashKey(k));
    const b = Buffer.from(hashKey(ADMIN_KEY));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch { return false; }
}
function keyAllowsRead(session, key) {
  // If no keys on session, open access (legacy behavior)
  if (!session || (!session.editKeyHash)) return true;
  if (!key) return false;
  try {
    const a = Buffer.from(hashKey(key));
    const b = Buffer.from(String(session.editKeyHash || ''));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch { return false; }
}
function keyAllowsWrite(session, key) {
  return keyAllowsRead(session, key);
}

// --- API ---
app.post('/api/sessions', (req, res) => {
  // If ADMIN_KEY is configured, require it for creation
  if (ADMIN_KEY && !isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
  const name = (req.body && typeof req.body.name === 'string' && req.body.name.trim()) || null;
  // Generate per-session edit key if ADMIN_KEY is enabled
  let editKey, editKeyHash;
  if (ADMIN_KEY) {
    editKey = genKey(192);
    editKeyHash = hashKey(editKey);
  }
  const extra = editKeyHash ? { editKeyHash, createdAt: Date.now(), lastAccess: Date.now(), answers: {} } : { answers: {} };
  const session = createSession(name || '', extra);
  const base = `${req.protocol || 'http'}://${req.headers.host}`;
  const links = editKey ? { edit: `${base}/?id=${session.id}&key=${editKey}` } : undefined;
  res.status(201).json(links ? { ...session, links } : session);
});

app.get('/api/sessions/:id', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Not found' });
  if (ADMIN_KEY) {
    const admin = isAdmin(req);
    const k = extractKey(req);
    if (!admin && !keyAllowsRead(session, k)) return res.status(403).json({ error: 'Forbidden' });
  }
  // update lastAccess best-effort
  if (session && session.id && typeof session.lastAccess !== 'undefined') {
    try {
      session.lastAccess = Date.now();
      saveSession(session);
    } catch {}
  }
  res.json(session);
});

// PATCH operations mutate a session's asked/skipped arrays.
// We use updateSession to serialize concurrent writes for the same session id.
app.patch('/api/sessions/:id', async (req, res) => {
  const id = req.params.id;
  const action = req.body && req.body.action;
  const question = req.body && req.body.question; // { theme, text }
  let allow = true;
  let isAdminReq = false;
  if (ADMIN_KEY) {
    isAdminReq = isAdmin(req);
    const session = getSession(id);
    if (!session) return res.status(404).json({ error: 'Not found' });
    const k = extractKey(req);
    allow = isAdminReq || keyAllowsWrite(session, k);
    if (!allow) return res.status(403).json({ error: 'Forbidden' });
  }
  const updated = await updateSession(id, (session) => {
    if (!session) return null;
    switch (action) {
      case 'markAsked':
        if (question && question.text) {
          session.asked.push(question);
          // If it was skipped earlier, remove the last matching skipped
          const idx = session.skipped.findIndex(q => q.text === question.text);
          if (idx !== -1) session.skipped.splice(idx, 1);
        }
        break;
      case 'setAnswer':
        if (!session.answers || typeof session.answers !== 'object') session.answers = {};
        {
          const key = question && question.text ? String(question.text) : '';
          const value = (req.body && typeof req.body.value === 'string') ? req.body.value : '';
          if (key) session.answers[key] = value;
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
        // invalid action, return session unchanged
        break;
    }
    if (typeof session.lastAccess !== 'undefined') session.lastAccess = Date.now();
    return session;
  }).catch((e) => null);

  if (!updated) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.json(updated);
});

// --- Capability Sessions (always key-gated; no ADMIN_KEY required) ---
app.post('/api/capsessions', (req, res) => {
  const name = (req.body && typeof req.body.name === 'string' && req.body.name.trim()) || null;
  // Always generate an edit key for capability sessions
  const editKey = genKey(192);
  const editKeyHash = hashKey(editKey);
  const extra = { editKeyHash, createdAt: Date.now(), lastAccess: Date.now(), cap: true, answers: {} };
  const session = createSession(name || '', extra);
  const base = `${req.protocol || 'http'}://${req.headers.host}`;
  const links = { edit: `${base}/?id=${session.id}&key=${editKey}&cap=1` };
  res.status(201).json({ ...session, links });
});

app.get('/api/capsessions/:id', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Not found' });
  const k = extractKey(req);
  if (!keyAllowsRead(session, k)) return res.status(403).json({ error: 'Forbidden' });
  try { session.lastAccess = Date.now(); saveSession(session); } catch {}
  res.json(session);
});

app.patch('/api/capsessions/:id', async (req, res) => {
  const id = req.params.id;
  const k = extractKey(req);
  const session = getSession(id);
  if (!session) return res.status(404).json({ error: 'Not found' });
  if (!keyAllowsWrite(session, k)) return res.status(403).json({ error: 'Forbidden' });

  const action = req.body && req.body.action;
  const question = req.body && req.body.question;
  const updated = await updateSession(id, (s) => {
    if (!s) return null;
    switch (action) {
      case 'markAsked':
        if (question && question.text) {
          s.asked.push(question);
          const idx = s.skipped.findIndex(q => q.text === question.text);
          if (idx !== -1) s.skipped.splice(idx, 1);
        }
        break;
      case 'setAnswer':
        if (!s.answers || typeof s.answers !== 'object') s.answers = {};
        {
          const key = question && question.text ? String(question.text) : '';
          const value = (req.body && typeof req.body.value === 'string') ? req.body.value : '';
          if (key) s.answers[key] = value;
        }
        break;
      case 'markSkipped':
        if (question && question.text) {
          s.skipped.push(question);
          const idx = s.asked.findIndex(q => q.text === question.text);
          if (idx !== -1) s.asked.splice(idx, 1);
        }
        break;
      case 'undoAsked':
        s.asked.pop();
        break;
      case 'undoSkipped':
        s.skipped.pop();
        break;
      case 'reset':
        s.asked = [];
        s.skipped = [];
        break;
      default:
        break;
    }
    s.lastAccess = Date.now();
    return s;
  }).catch(() => null);
  if (!updated) return res.status(404).json({ error: 'Not found' });
  res.json(updated);
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
