const express = require('express');
const path = require('path');
const { createSession, getSession, saveSession, updateSession, listSessions, deleteSession } = require('./server/sessionStore');
const { genKey, hashKey, extractKey, isAdmin, keyAllowsRead, capKeyAllowsRead, keyAllowsWrite, KEY_SIZE_EDIT, KEY_SIZE_VIEW, ADMIN_KEY } = require('./api/_crypto');
const { validateSessionName } = require('./api/_validation');
const { applySessionAction } = require('./api/_sessionActions');
const { auditLog } = require('./api/_audit');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to validate Content-Type for JSON endpoints
const requireJsonContentType = (req, res, next) => {
  // Only check POST, PATCH, PUT methods that should have JSON body
  if (['POST', 'PATCH', 'PUT'].includes(req.method)) {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('application/json')) {
      return res.status(415).json({ error: 'Content-Type must be application/json' });
    }
  }
  next();
};

app.use(express.json());
app.use(requireJsonContentType);

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Admin API ---
app.get('/api/admin/sessions', (req, res) => {
  if (!ADMIN_KEY || !isAdmin(req)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const list = listSessions();
  // Hide sensitive hashes in admin list
  const safe = list.map(s => ({ id: s.id, name: s.name, createdAt: s.createdAt, lastAccess: s.lastAccess }));
  res.json({ sessions: safe });
});

app.post('/api/admin/sessions', (req, res) => {
  if (!ADMIN_KEY || !isAdmin(req)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  // Validate session name
  const validation = validateSessionName(req.body?.name);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }
  const name = validation.sanitized;
  const editKey = genKey(KEY_SIZE_EDIT);
  const editKeyHash = hashKey(editKey);
  const viewKey = genKey(KEY_SIZE_VIEW);
  const viewKeyHash = hashKey(viewKey);
  const session = createSession(name, { editKeyHash, viewKeyHash, createdAt: Date.now(), lastAccess: Date.now(), answers: {} });

  // Audit log
  auditLog('session.create', { sessionId: session.id, sessionName: name, admin: true }, req);

  const base = `${req.protocol || 'http'}://${req.headers.host}`;
  const links = { edit: `${base}/?id=${session.id}&key=${editKey}&cap=1`, view: `${base}/results.html?id=${session.id}&key=${viewKey}&cap=1` };
  res.status(201).json({ ...session, links });
});

app.get('/api/admin/sessions/:id', (req, res) => {
  if (!ADMIN_KEY || !isAdmin(req)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const session = getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Not found' });
  }
  const safe = {
    id: session.id,
    name: session.name,
    createdAt: session.createdAt,
    lastAccess: session.lastAccess,
    message: 'Keys are not recoverable after creation. Please save them when creating sessions.'
  };
  res.json(safe);
});

app.delete('/api/admin/sessions/:id', async (req, res) => {
  if (!ADMIN_KEY || !isAdmin(req)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const session = getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Not found' });
  }

  // Audit log before deletion
  auditLog('session.delete', { sessionId: req.params.id, sessionName: session.name, admin: true }, req);

  await deleteSession(req.params.id);
  res.json({ success: true });
});

// --- API ---
app.post('/api/sessions', (req, res) => {
  // If ADMIN_KEY is configured, require it for creation
  if (ADMIN_KEY && !isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
  const name = (req.body && typeof req.body.name === 'string' && req.body.name.trim()) || null;
  // Generate per-session keys if ADMIN_KEY is enabled
  let editKey, editKeyHash, viewKey, viewKeyHash;
  if (ADMIN_KEY) {
    editKey = genKey(192);
    editKeyHash = hashKey(editKey);
    viewKey = genKey(160);
    viewKeyHash = hashKey(viewKey);
  }
  const extra = editKeyHash ? { editKeyHash, viewKeyHash, createdAt: Date.now(), lastAccess: Date.now(), answers: {} } : { answers: {} };
  const session = createSession(name || '', extra);
  const base = `${req.protocol || 'http'}://${req.headers.host}`;
  const links = editKey ? { edit: `${base}/?id=${session.id}&key=${editKey}`, view: `${base}/results.html?id=${session.id}&key=${viewKey}` } : undefined;
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
    } catch (e) {
      // lastAccess is best-effort, non-critical, but log the error for monitoring
      console.warn('[session] Failed to update lastAccess:', e.message);
    }
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
  const value = (req.body && typeof req.body.value === 'string') ? req.body.value : '';
  const updated = await updateSession(id, (session) => {
    return applySessionAction(session, action, question, value);
  }).catch((e) => null);

  if (!updated) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.json(updated);
});

// --- Capability Sessions (no authentication required) ---
app.post('/api/capsessions', (req, res) => {
  const name = (req.body && typeof req.body.name === 'string' && req.body.name.trim()) || null;
  if (!name) {
    return res.status(400).json({ error: 'Invalid name' });
  }
  // Generate a single access key (full access - no separate edit/view)
  const accessKey = genKey(192);
  const accessKeyHash = hashKey(accessKey);
  const extra = {
    editKeyHash: accessKeyHash,
    viewKeyHash: accessKeyHash, // Same key for read and write
    createdAt: Date.now(),
    lastAccess: Date.now(),
    cap: true,
    answers: {}
  };
  const session = createSession(name, extra);
  const base = `${req.protocol || 'http'}://${req.headers.host}`;
  const url = `${base}/?id=${session.id}&key=${accessKey}&cap=1`;
  res.status(201).json({ ...session, url });
});

app.get('/api/capsessions/:id', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Not found' });
  const k = extractKey(req);
  if (!capKeyAllowsRead(session, k)) return res.status(403).json({ error: 'Forbidden' });
  try {
    session.lastAccess = Date.now();
    saveSession(session);
  } catch (e) {
    // lastAccess is best-effort, non-critical, but log the error for monitoring
    console.warn('[session] Failed to update lastAccess:', e.message);
  }
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
