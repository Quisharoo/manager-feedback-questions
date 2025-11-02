const { parseBody, logRequest, requireJsonContentType } = require('../../api/_utils');
const store = require('../../api/_store');
const { genKey, hashKey, isAdmin, KEY_SIZE_EDIT, KEY_SIZE_VIEW, ADMIN_KEY } = require('../../api/_crypto');
const { createRateLimiter } = require('../../api/_rateLimit');
const { validateSessionName } = require('../../api/_validation');

// Rate limit: 5 sessions per hour per IP
const checkRateLimit = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 5 });

module.exports = async (req, res) => {
  logRequest(req);
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST');
    return res.end('Method Not Allowed');
  }

  // Validate Content-Type
  if (!requireJsonContentType(req, res)) {
    return; // Error response already sent
  }

  // Check admin authentication if ADMIN_KEY is configured
  if (ADMIN_KEY && !isAdmin(req)) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Forbidden: Admin authentication required' }));
  }

  // Check rate limit (only for non-admin users to prevent abuse)
  const rateLimitResult = checkRateLimit(req);
  if (!rateLimitResult.allowed) {
    res.statusCode = 429;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Retry-After', rateLimitResult.retryAfter);
    return res.end(JSON.stringify({
      error: 'Too many session creation requests. Please try again later.',
      retryAfter: rateLimitResult.retryAfter
    }));
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
  // Generate separate keys for edit and view access (capability-based security)
  const editKey = genKey(KEY_SIZE_EDIT);
  const editKeyHash = hashKey(editKey);
  const viewKey = genKey(KEY_SIZE_VIEW);
  const viewKeyHash = hashKey(viewKey);
  const session = await store.createSession(name, {
    editKeyHash,
    viewKeyHash,
    createdAt: Date.now(),
    lastAccess: Date.now(),
    cap: true
  });
  const host = (req.headers && req.headers.host) || 'localhost';
  const proto = (req.headers && req.headers['x-forwarded-proto']) || 'http';
  const base = `${proto}://${host}`;
  const links = {
    edit: `${base}/?id=${session.id}&key=${editKey}&cap=1`,
    view: `${base}/results.html?id=${session.id}&key=${viewKey}&cap=1`
  };
  res.statusCode = 201;
  res.setHeader('Content-Type', 'application/json');
  return res.end(JSON.stringify({ ...session, links }));
};


