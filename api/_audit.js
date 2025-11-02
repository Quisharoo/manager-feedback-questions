/**
 * Audit logging for admin actions
 * Provides structured logging for security-sensitive operations
 */

/**
 * Get client IP address from request
 * @param {Object} req - Request object
 * @returns {string} IP address
 */
function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         'unknown';
}

/**
 * Log an audit event
 * @param {string} action - Action performed (e.g., 'session.create', 'session.delete')
 * @param {Object} details - Additional details about the action
 * @param {Object} req - Request object (optional)
 */
function auditLog(action, details = {}, req = null) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    action,
    ...details
  };

  // Add request metadata if available
  if (req) {
    logEntry.ip = getClientIp(req);
    logEntry.userAgent = req.headers['user-agent'];
  }

  // Use structured console.info for audit logs
  console.info('[audit]', JSON.stringify(logEntry));
}

module.exports = { auditLog };
