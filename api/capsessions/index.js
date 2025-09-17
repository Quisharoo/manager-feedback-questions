const crypto = require('crypto');
const { parseBody, logRequest } = require('../../api/_utils');
const store = require('../../api/_store');

const ADMIN_KEY = process.env.ADMIN_KEY || '';
const COOKIE_SECRET = process.env.COOKIE_SECRET || 'dev-secret';
function hashKey(key) { return crypto.createHmac('sha256', COOKIE_SECRET).update(String(key || '')) .digest('base64'); }
function genKey(bits = 192) { return crypto.randomBytes(bits / 8).toString('base64url'); }
function extractKey(req) {
  const auth = req.headers && req.headers.authorization;
  const m = auth && auth.match(/^Key\s+(.+)$/i);
  return (m && m[1]) || '';
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
  const session = await store.createSession(name, { editKeyHash, createdAt: Date.now(), lastAccess: Date.now(), cap: true });
  const host = (req.headers && req.headers.host) || 'localhost';
  const proto = (req.headers && req.headers['x-forwarded-proto']) || 'http';
  const base = `${proto}://${host}`;
  const links = { edit: `${base}/?id=${session.id}&key=${editKey}&cap=1` };
  res.statusCode = 201;
  res.setHeader('Content-Type', 'application/json');
  return res.end(JSON.stringify({ ...session, links }));
};


