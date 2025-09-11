const { parseBody, readSessionFromCookies, writeSessionCookie, logRequest } = require('../_utils');

module.exports = async (req, res) => {
  logRequest(req);
  const { id } = req.query || {};

  if (!id) {
    res.statusCode = 400;
    res.end('Missing id');
    return;
  }

  let session = readSessionFromCookies(req, id);
  if (!session) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  if (req.method === 'GET') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(session));
    return;
  }

  if (req.method === 'PATCH') {
    const body = await parseBody(req);
    const action = body.action;
    const question = body.question;
    switch (action) {
      case 'markAsked':
        if (question && question.text) {
          session.asked.push(question);
          const idx = session.skipped.findIndex(q => q.text === question.text);
          if (idx !== -1) session.skipped.splice(idx, 1);
        }
        break;
      case 'markSkipped':
        if (question && question.text) {
          session.skipped.push(question);
          const idx = session.asked.findIndex(q => q.text === question.text);
          if (idx !== -1) session.asked.splice(idx, 1);
        }
        break;
      case 'undoAsked':
        session.asked.pop();
        break;
      case 'undoSkipped':
        session.skipped.pop();
        break;
      case 'reset':
        session.asked = [];
        session.skipped = [];
        break;
      default:
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Invalid action' }));
        return;
    }
    writeSessionCookie(res, session);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(session));
    return;
  }

  res.statusCode = 405;
  res.setHeader('Allow', 'GET, PATCH');
  res.end('Method Not Allowed');
};
