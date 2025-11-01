const { logRequest } = require('../../../api/_utils');
const store = require('../../../api/_store');
const { isAdmin, ADMIN_KEY } = require('../../../api/_crypto');
const { auditLog } = require('../../../api/_audit');

module.exports = async (req, res) => {
  logRequest(req);
  if (!ADMIN_KEY || !isAdmin(req)) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Forbidden' }));
  }

  const { id } = req.query || {};
  if (!id) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Missing id' }));
  }

  if (req.method === 'GET') {
    const session = await store.getSession(id);
    if (!session) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Not found' }));
    }

    // Admin can see session details but NOT the actual keys (they're hashed)
    // Return session info without sensitive hashes
    const safe = {
      id: session.id,
      name: session.name,
      createdAt: session.createdAt,
      lastAccess: session.lastAccess,
      // Note: We cannot recover the original keys from hashes
      // This is by design for security
      message: 'Keys are not recoverable after creation. Please save them when creating sessions.'
    };

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(safe));
  }

  if (req.method === 'DELETE') {
    const session = await store.getSession(id);
    if (!session) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Not found' }));
    }

    // Audit log before deletion
    auditLog('session.delete', { sessionId: id, sessionName: session.name, admin: true }, req);

    await store.deleteSession(id);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ success: true }));
  }

  res.statusCode = 405;
  res.setHeader('Allow', 'GET, DELETE');
  res.end('Method Not Allowed');
};
