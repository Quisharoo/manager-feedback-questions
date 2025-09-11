const { randomUUID } = require('crypto');
const { parseBody, writeSessionCookie, logRequest } = require('../_utils');

module.exports = async (req, res) => {
  logRequest(req);
  try {
    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.setHeader('Allow', 'POST');
      return res.end('Method Not Allowed');
    }

    const body = await parseBody(req);
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Invalid name' }));
    }

    const session = { id: randomUUID(), name, asked: [], skipped: [] };
    writeSessionCookie(res, session);
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
