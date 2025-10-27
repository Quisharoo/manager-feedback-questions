const crypto = require('crypto');

// Parse JSON body for serverless-style requests
function parseBody(req) {
  return new Promise(resolve => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try {
        resolve(JSON.parse(data || '{}'));
      } catch (e) {
        console.error('[api] parseBody: Invalid JSON, returning empty object', e.message);
        resolve({});
      }
    });
  });
}

// Minimal cookie parser (header → key/value map)
function parseCookies(req) {
  const header = (req.headers && req.headers.cookie) || '';
  return header.split(';').reduce((acc, pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return acc;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    if (!key) return acc;
    acc[key] = decodeURIComponent(val);
    return acc;
  }, {});
}

// Cookie signing prevents client-side tampering of session payloads.
// HMAC-SHA256 over the base64url JSON; format: <value>.<signature>
const COOKIE_SECRET = process.env.COOKIE_SECRET || 'dev-secret';
function sign(value) {
  const mac = crypto.createHmac('sha256', COOKIE_SECRET).update(value).digest('base64url');
  return `${value}.${mac}`;
}
function verify(signedValue) {
  try {
    const idx = signedValue.lastIndexOf('.');
    if (idx === -1) return null;
    const value = signedValue.slice(0, idx);
    const mac = signedValue.slice(idx + 1);
    const expected = crypto.createHmac('sha256', COOKIE_SECRET).update(value).digest('base64url');
    const ok = crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected));
    return ok ? value : null;
  } catch {
    return null;
  }
}

// Encode a slim session payload (IDs only) into a signed cookie value
function encodeSessionCookie(sessionSlim) {
  const json = JSON.stringify(sessionSlim);
  const raw = Buffer.from(json).toString('base64url');
  return sign(raw);
}

// Decode and verify a cookie; supports legacy unsigned payloads for compatibility
function decodeSessionCookie(value) {
  const verified = verify(value);
  let raw = verified;
  if (!raw) raw = value; // fallback for old cookies
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// Read a session cookie for a specific id
function readSessionFromCookies(req, id) {
  const cookies = parseCookies(req);
  const key = `mfq_s_${id}`;
  const raw = cookies[key];
  if (!raw) return null;
  const session = decodeSessionCookie(raw);
  return session && session.id === id ? session : null;
}

// Write a session cookie with safe defaults; Secure is added in production
function writeSessionCookie(res, sessionSlim) {
  const key = `mfq_s_${sessionSlim.id}`;
  const value = encodeURIComponent(encodeSessionCookie(sessionSlim));
  const parts = [
    `${key}=${value}`,
    'Path=/api/sessions',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=31536000',
  ];
  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }
  const cookie = parts.join('; ');
  const existing = res.getHeader && res.getHeader('Set-Cookie');
  if (existing) {
    const arr = Array.isArray(existing) ? existing.concat(cookie) : [existing, cookie];
    res.setHeader('Set-Cookie', arr);
  } else {
    res.setHeader('Set-Cookie', cookie);
  }
}

// Minimal request log for diagnostics without leaking sensitive headers
function logRequest(req, extra) {
  try {
    const headers = req.headers || {};
    const loggedHeaders = {
      'content-type': headers['content-type'],
      'user-agent': headers['user-agent'],
      'x-forwarded-for': headers['x-forwarded-for'],
      cookie: headers.cookie ? '(present)' : undefined,
    };
    // eslint-disable-next-line no-console
    // redact any key in query string
    let safeUrl = req.url || '';
    try {
      const u = new URL(req.url, 'http://localhost');
      if (u.searchParams.has('key')) u.searchParams.set('key', 'REDACTED');
      safeUrl = u.pathname + (u.search ? u.search : '');
    } catch {}
    console.info('[api] request', { method: req.method, url: safeUrl, headers: loggedHeaders, ...extra });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.info('[api] request');
  }
}

module.exports = { parseBody, parseCookies, readSessionFromCookies, writeSessionCookie, logRequest, decodeSessionCookie };
