const crypto = require('crypto');
const { parseBody, logRequest } = require('../../../api/_utils');
const store = require('../../../api/_store');

const ADMIN_KEY = process.env.ADMIN_KEY || '';
const COOKIE_SECRET = process.env.COOKIE_SECRET || 'dev-secret';
function hashKey(key) { return crypto.createHmac('sha256', COOKIE_SECRET).update(String(key || '')) .digest('base64'); }
function extractKey(req) {
  const auth = req.headers && req.headers.authorization;
  const m = auth && auth.match(/^Key\s+(.+)$/i);
  return ((m && m[1]) || '').trim();
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
    const { randomBytes } = require('crypto');
    const editKey = randomBytes(24).toString('base64url');
    const editKeyHash = hashKey(editKey);
    const session = await store.createSession(name, { editKeyHash, createdAt: Date.now(), lastAccess: Date.now() });
    const host = (req.headers && req.headers.host) || '';
    const proto = (req.headers && req.headers['x-forwarded-proto']) || 'http';
    const base = `${proto}://${host}`;
    const links = { edit: `${base}/?id=${session.id}&key=${editKey}&cap=1` };
    res.statusCode = 201;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ ...session, links }));
  }

  res.statusCode = 405;
  res.setHeader('Allow', 'GET, POST');
  res.end('Method Not Allowed');
};


