const crypto = require('crypto');

function parseBody(req) {
  return new Promise(resolve => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try {
        resolve(JSON.parse(data || '{}'));
      } catch {
        resolve({});
      }
    });
  });
}

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

// --- Cookie signing helpers ---
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

function encodeSessionCookie(sessionSlim) {
  const json = JSON.stringify(sessionSlim);
  const raw = Buffer.from(json).toString('base64url');
  return sign(raw);
}

function decodeSessionCookie(value) {
  // First try to verify a signed payload
  const verified = verify(value);
  let raw = verified;
  // Fallback: support legacy unsigned cookie for backward compatibility
  if (!raw) raw = value;
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function readSessionFromCookies(req, id) {
  const cookies = parseCookies(req);
  const key = `mfq_s_${id}`;
  const raw = cookies[key];
  if (!raw) return null;
  const session = decodeSessionCookie(raw);
  return session && session.id === id ? session : null;
}

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
    console.info('[api] request', { method: req.method, url: req.url, headers: loggedHeaders, ...extra });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.info('[api] request');
  }
}

module.exports = { parseBody, parseCookies, readSessionFromCookies, writeSessionCookie, logRequest, decodeSessionCookie };
