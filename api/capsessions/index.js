const { parseBody, logRequest } = require('../../api/_utils');
const store = require('../../api/_store');
const { genKey, hashKey, isAdmin, ADMIN_KEY } = require('../../api/_crypto');

module.exports = async (req, res) => {
  logRequest(req);
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST');
    return res.end('Method Not Allowed');
  }
  // If ADMIN_KEY is configured, require it to create
  if (ADMIN_KEY && !isAdmin(req)) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Forbidden' }));
  }
  const body = await parseBody(req);
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Invalid name' }));
  }
  const editKey = genKey();
  const editKeyHash = hashKey(editKey);
  const viewKey = genKey(160);
  const viewKeyHash = hashKey(viewKey);
  const session = await store.createSession(name, { editKeyHash, viewKeyHash, createdAt: Date.now(), lastAccess: Date.now(), cap: true });
  const host = (req.headers && req.headers.host) || 'localhost';
  const proto = (req.headers && req.headers['x-forwarded-proto']) || 'http';
  const base = `${proto}://${host}`;
  const links = { edit: `${base}/?id=${session.id}&key=${editKey}&cap=1`, view: `${base}/results.html?id=${session.id}&key=${viewKey}&cap=1` };
  res.statusCode = 201;
  res.setHeader('Content-Type', 'application/json');
  return res.end(JSON.stringify({ ...session, links }));
};


