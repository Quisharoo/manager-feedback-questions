const { createSession } = require('../../sessionStore');
const { parseBody } = require('../_utils');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST');
    return res.end('Method Not Allowed');
  }

  const body = await parseBody(req);
  const name = (body && typeof body.name === 'string' && body.name.trim()) || '';
  const session = createSession(name);
  res.statusCode = 201;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(session));
};
