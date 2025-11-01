const { parseBody, readSessionFromCookies, writeSessionCookie, logRequest, requireJsonContentType } = require('../_utils');
const { idFromAny, toQuestion } = require('../questions');

module.exports = async (req, res) => {
  logRequest(req);
  const { id } = req.query || {};

  if (!id) {
    res.statusCode = 400;
    res.end('Missing id');
    return;
  }

  // Read slim session (IDs only) from cookie
  let sessionSlim = readSessionFromCookies(req, id);
  if (!sessionSlim) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  // Backward-compat: normalize older cookie format with full objects
  if (!Array.isArray(sessionSlim.askedIds) && Array.isArray(sessionSlim.asked)) {
    sessionSlim.askedIds = sessionSlim.asked.map(q => idFromAny(q)).filter(Boolean);
    delete sessionSlim.asked;
  }
  if (!Array.isArray(sessionSlim.skippedIds) && Array.isArray(sessionSlim.skipped)) {
    sessionSlim.skippedIds = sessionSlim.skipped.map(q => idFromAny(q)).filter(Boolean);
    delete sessionSlim.skipped;
  }
  if (!Array.isArray(sessionSlim.askedIds)) sessionSlim.askedIds = [];
  if (!Array.isArray(sessionSlim.skippedIds)) sessionSlim.skippedIds = [];

  // Expand IDs to full question objects for API responses
  function expand(session) {
    return {
      id: session.id,
      name: session.name,
      asked: session.askedIds.map(toQuestion).filter(Boolean),
      skipped: session.skippedIds.map(toQuestion).filter(Boolean),
    };
  }

  if (req.method === 'GET') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(expand(sessionSlim)));
    return;
  }

  if (req.method === 'PATCH') {
    // Validate Content-Type
    if (!requireJsonContentType(req, res)) {
      return; // Error response already sent
    }

    const body = await parseBody(req);
    const action = body.action;
    const question = body.question;
    const qid = idFromAny(question);
    // Apply update to slim session
    switch (action) {
      case 'markAsked':
        if (qid) {
          if (!sessionSlim.askedIds.includes(qid)) sessionSlim.askedIds.push(qid);
          const idx = sessionSlim.skippedIds.indexOf(qid);
          if (idx !== -1) sessionSlim.skippedIds.splice(idx, 1);
        }
        break;
      case 'markSkipped':
        if (qid) {
          if (!sessionSlim.skippedIds.includes(qid)) sessionSlim.skippedIds.push(qid);
          const idx = sessionSlim.askedIds.indexOf(qid);
          if (idx !== -1) sessionSlim.askedIds.splice(idx, 1);
        }
        break;
      case 'undoAsked':
        sessionSlim.askedIds.pop();
        break;
      case 'undoSkipped':
        sessionSlim.skippedIds.pop();
        break;
      case 'reset':
        sessionSlim.askedIds = [];
        sessionSlim.skippedIds = [];
        break;
      default:
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Invalid action' }));
        return;
    }
    // Persist back to cookie
    writeSessionCookie(res, sessionSlim);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(expand(sessionSlim)));
    return;
  }

  res.statusCode = 405;
  res.setHeader('Allow', 'GET, PATCH');
  res.end('Method Not Allowed');
};
