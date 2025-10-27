const { parseBody, logRequest } = require('../../../api/_utils');
const store = require('../../../api/_store');
const { genKey, hashKey, isAdmin, ADMIN_KEY } = require('../../../api/_crypto');

module.exports = async (req, res) => {
  logRequest(req);
  if (!ADMIN_KEY || !isAdmin(req)) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Forbidden' }));
  }

  if (req.method === 'GET') {
    const list = await store.listSessions();
    // Hide sensitive hashes in admin list
    const safe = list.map(s => ({ id: s.id, name: s.name, createdAt: s.createdAt, lastAccess: s.lastAccess }));
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ sessions: safe }));
  }

  if (req.method === 'POST') {
    const body = await parseBody(req);
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Invalid name' }));
    }
    const editKey = genKey(192);
    const editKeyHash = hashKey(editKey);
    const viewKey = genKey(160);
    const viewKeyHash = hashKey(viewKey);
    const session = await store.createSession(name, { editKeyHash, viewKeyHash, createdAt: Date.now(), lastAccess: Date.now(), answers: {} });
    const host = (req.headers && req.headers.host) || '';
    const proto = (req.headers && req.headers['x-forwarded-proto']) || 'http';
    const base = `${proto}://${host}`;
    const links = { edit: `${base}/?id=${session.id}&key=${editKey}&cap=1`, view: `${base}/results.html?id=${session.id}&key=${viewKey}&cap=1` };
    res.statusCode = 201;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ ...session, links }));
  }

  res.statusCode = 405;
  res.setHeader('Allow', 'GET, POST');
  res.end('Method Not Allowed');
};


