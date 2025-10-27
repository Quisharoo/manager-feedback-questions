const crypto = require('crypto');

/**
 * Generate a random key
 * @param {number} bits - Key size in bits (default 192)
 * @returns {string} Base64url-encoded random key
 */
function genKey(bits = 192) {
  return crypto.randomBytes(bits / 8).toString('base64url');
}

/**
 * Hash a key using HMAC-SHA256
 * @param {string} key - Key to hash
 * @returns {string} Base64-encoded hash
 */
function hashKey(key) {
  const HMAC_SECRET = process.env.COOKIE_SECRET || 'dev-secret';
  return crypto.createHmac('sha256', HMAC_SECRET).update(String(key || '')).digest('base64');
}

/**
 * Extract capability key from request (query param or Authorization header)
 * @param {Object} req - Request object
 * @returns {string} Extracted key or empty string
 */
function extractKey(req) {
  const q = req.query && req.query.key;
  const auth = req.headers && req.headers.authorization;
  const m = auth && auth.match(/^Key\s+(.+)$/i);
  return (q || (m && m[1]) || '').trim();
}

/**
 * Extract key only from Authorization header (used for admin auth)
 * @param {Object} req - Request object
 * @returns {string} Extracted key or empty string
 */
function extractHeaderKey(req) {
  const auth = req.headers && req.headers.authorization;
  const m = auth && auth.match(/^Key\s+(.+)$/i);
  return (m && m[1] ? m[1] : '').trim();
}

/**
 * Check if request includes valid admin key
 * @param {Object} req - Request object
 * @returns {boolean} True if admin key is valid
 */
function isAdmin(req) {
  const ADMIN_KEY = process.env.ADMIN_KEY || '';
  if (!ADMIN_KEY) return false;
  const k = extractHeaderKey(req);
  if (!k) return false;
  try {
    const a = Buffer.from(hashKey(k));
    const b = Buffer.from(hashKey(ADMIN_KEY));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Check if key allows read access to session (for regular sessions with legacy support)
 * @param {Object} session - Session object
 * @param {string} key - Key to verify
 * @returns {boolean} True if key grants read access
 */
function keyAllowsRead(session, key) {
  // Legacy sessions without keys have open access
  if (!session || !session.editKeyHash) return true;
  if (!key) return false;
  try {
    const provided = Buffer.from(hashKey(key));
    const editHash = Buffer.from(String(session.editKeyHash || ''));
    const viewHash = Buffer.from(String(session.viewKeyHash || ''));
    const matchesEdit = (provided.length === editHash.length) && crypto.timingSafeEqual(provided, editHash);
    const matchesView = (viewHash.length > 0) && (provided.length === viewHash.length) && crypto.timingSafeEqual(provided, viewHash);
    return matchesEdit || matchesView;
  } catch {
    return false;
  }
}

/**
 * Check if key allows read access to capability session (always requires keys)
 * @param {Object} session - Session object
 * @param {string} key - Key to verify
 * @returns {boolean} True if key grants read access
 */
function capKeyAllowsRead(session, key) {
  if (!session || !session.editKeyHash) return false;
  if (!key) return false;
  try {
    const provided = Buffer.from(hashKey(key));
    const editHash = Buffer.from(String(session.editKeyHash || ''));
    const viewHash = Buffer.from(String(session.viewKeyHash || ''));
    const matchesEdit = (provided.length === editHash.length) && crypto.timingSafeEqual(provided, editHash);
    const matchesView = (viewHash.length > 0) && (provided.length === viewHash.length) && crypto.timingSafeEqual(provided, viewHash);
    return matchesEdit || matchesView;
  } catch {
    return false;
  }
}

/**
 * Check if key allows write access to session
 * @param {Object} session - Session object
 * @param {string} key - Key to verify
 * @returns {boolean} True if key grants write access
 */
function keyAllowsWrite(session, key) {
  if (!session || !session.editKeyHash) return false;
  if (!key) return false;
  try {
    const provided = Buffer.from(hashKey(key));
    const editHash = Buffer.from(String(session.editKeyHash || ''));
    return provided.length === editHash.length && crypto.timingSafeEqual(provided, editHash);
  } catch {
    return false;
  }
}

module.exports = {
  genKey,
  hashKey,
  extractKey,
  isAdmin,
  keyAllowsRead,
  capKeyAllowsRead,
  keyAllowsWrite,
  get ADMIN_KEY() { return process.env.ADMIN_KEY || ''; },
  get HMAC_SECRET() { return process.env.COOKIE_SECRET || 'dev-secret'; }
};
