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

function encodeSessionCookie(session) {
  const json = JSON.stringify(session);
  return Buffer.from(json).toString('base64url');
}

function decodeSessionCookie(value) {
  try {
    const json = Buffer.from(value, 'base64url').toString('utf8');
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

function writeSessionCookie(res, session) {
  const key = `mfq_s_${session.id}`;
  const cookie = `${key}=${encodeURIComponent(encodeSessionCookie(session))}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`;
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

module.exports = { parseBody, parseCookies, readSessionFromCookies, writeSessionCookie, logRequest };
