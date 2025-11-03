const { parseBody, logRequest, requireJsonContentType } = require('../../api/_utils');
const store = require('../../api/_store');
const { extractKey, capKeyAllowsRead, keyAllowsWrite } = require('../../api/_crypto');
const { applySessionAction } = require('../../api/_sessionActions');

module.exports = async (req, res) => {
  logRequest(req);
  const { id } = req.query || {};
  if (!id) {
    res.statusCode = 400;
    return res.end('Missing id');
  }
  const session = await store.getSession(id);
  if (!session) {
    console.error('[capsessions] Session not found on initial fetch:', { id, method: req.method });
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Not found' }));
  }

  if (req.method === 'PATCH') {
    console.log('[capsessions] PATCH request for session:', { id, hasSession: !!session });
  }
  const key = extractKey(req);
  if (!capKeyAllowsRead(session, key)) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Forbidden' }));
  }

  if (req.method === 'GET') {
    session.lastAccess = Date.now();
    await store.saveSession(session);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(session));
  }

  if (req.method === 'PATCH') {
    // Validate Content-Type
    if (!requireJsonContentType(req, res)) {
      return; // Error response already sent
    }

    if (!keyAllowsWrite(session, key)) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Forbidden' }));
    }
    const body = await parseBody(req);
    const action = body.action;
    const question = body.question; // { text }
    const value = typeof body.value === 'string' ? body.value : '';

    const updated = await store.updateSession(id, (s) => {
      return applySessionAction(s, action, question, value);
    }).catch((err) => {
      console.error('[capsessions] updateSession failed:', {
        id,
        error: err.message,
        stack: err.stack
      });
      return null;
    });

    if (!updated) {
      console.error('[capsessions] Session not found during update:', { id });
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Session not found or update failed' }));
    }

    // Check if validation failed
    if (updated.error && !updated.id) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: updated.error }));
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(updated));
  }

  res.statusCode = 405;
  res.setHeader('Allow', 'GET, PATCH');
  res.end('Method Not Allowed');
};


