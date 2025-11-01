const { randomUUID } = require('crypto');
const { parseBody, writeSessionCookie, logRequest, requireJsonContentType } = require('../_utils');
const { validateSessionName } = require('../_validation');

module.exports = async (req, res) => {
  logRequest(req);
  try {
    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.setHeader('Allow', 'POST');
      return res.end('Method Not Allowed');
    }

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

    const session = { id: randomUUID(), name: validation.sanitized, asked: [], skipped: [] };
    const slim = { id: session.id, name: session.name, askedIds: [], skippedIds: [] };
    writeSessionCookie(res, slim);
    res.statusCode = 201;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(session));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api] /api/sessions error', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Internal Server Error' }));
  }
};
