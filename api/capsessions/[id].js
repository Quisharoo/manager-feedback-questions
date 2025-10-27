const { parseBody, logRequest } = require('../../api/_utils');
const store = require('../../api/_store');
const { extractKey, capKeyAllowsRead, keyAllowsWrite } = require('../../api/_crypto');

module.exports = async (req, res) => {
  logRequest(req);
  const { id } = req.query || {};
  if (!id) {
    res.statusCode = 400;
    return res.end('Missing id');
  }
  const session = await store.getSession(id);
  if (!session) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Not found' }));
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
      if (!s) return null;
      switch (action) {
        case 'markAsked':
          if (question && question.text) {
            s.asked.push(question);
            const idx = s.skipped.findIndex(q => q.text === question.text);
            if (idx !== -1) s.skipped.splice(idx, 1);
          }
          break;
        case 'markSkipped':
          if (question && question.text) {
            s.skipped.push(question);
            const idx = s.asked.findIndex(q => q.text === question.text);
            if (idx !== -1) s.asked.splice(idx, 1);
          }
          break;
        case 'undoAsked':
          s.asked.pop();
          break;
        case 'undoSkipped':
          s.skipped.pop();
          break;
        case 'reset':
          s.asked = [];
          s.skipped = [];
          // Clear all saved answers on reset to match UI behavior
          s.answers = {};
          s.currentQuestion = null;
          break;
        case 'setAnswer':
          s.answers = s.answers && typeof s.answers === 'object' ? s.answers : {};
          if (question && question.text) {
            s.answers[String(question.text)] = value;
          }
          break;
        case 'setCurrentQuestion':
          if (question && question.text) {
            s.currentQuestion = question;
          }
          break;
        default:
          break;
      }
      s.lastAccess = Date.now();
      return s;
    }).catch(() => null);

    if (!updated) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Not found' }));
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(updated));
  }

  res.statusCode = 405;
  res.setHeader('Allow', 'GET, PATCH');
  res.end('Method Not Allowed');
};


