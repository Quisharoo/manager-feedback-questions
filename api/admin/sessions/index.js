const { parseBody, logRequest, requireJsonContentType } = require('../../../api/_utils');
const store = require('../../../api/_store');
const { genKey, hashKey, isAdmin, KEY_SIZE_EDIT, KEY_SIZE_VIEW, ADMIN_KEY } = require('../../../api/_crypto');
const { validateSessionName } = require('../../../api/_validation');
const { auditLog } = require('../../../api/_audit');

module.exports = async (req, res) => {
  logRequest(req);
  if (!ADMIN_KEY || !isAdmin(req)) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Forbidden' }));
  }

  if (req.method === 'GET') {
    const list = await store.listSessions();
    // Hide sensitive hashes in admin list, but include metadata needed for UI
    const safe = list.map(s => ({ 
      id: s.id, 
      name: s.name, 
      createdAt: s.createdAt, 
      lastAccess: s.lastAccess,
      asked: s.asked || [] // Include asked questions array for UI display
    }));
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ sessions: safe }));
  }

  if (req.method === 'POST') {
    // Validate Content-Type
    if (!requireJsonContentType(req, res)) {
      return; // Error response already sent
    }

    const body = await parseBody(req);
    // Validate session name
    const validation = validateSessionName(body.name);
    if (!validation.valid) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: validation.error }));
    }
    const name = validation.sanitized;
    const editKey = genKey(KEY_SIZE_EDIT);
    const editKeyHash = hashKey(editKey);
    const viewKey = genKey(KEY_SIZE_VIEW);
    const viewKeyHash = hashKey(viewKey);
    const session = await store.createSession(name, { editKeyHash, viewKeyHash, createdAt: Date.now(), lastAccess: Date.now(), answers: {} });

    // Audit log
    auditLog('session.create', { sessionId: session.id, sessionName: name, admin: true }, req);

    const host = (req.headers && req.headers.host) || '';
    const proto = (req.headers && req.headers['x-forwarded-proto']) || 'http';
    const base = `${proto}://${host}`;
    const links = { edit: `${base}/?id=${session.id}&key=${editKey}`, view: `${base}/results.html?id=${session.id}&key=${viewKey}` };
    res.statusCode = 201;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ ...session, links }));
  }

  res.statusCode = 405;
  res.setHeader('Allow', 'GET, POST');
  res.end('Method Not Allowed');
};


