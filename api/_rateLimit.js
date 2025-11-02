/**
 * Simple in-memory rate limiter
 * Tracks requests by IP address and enforces limits
 */

const rateLimitStore = new Map();

/**
 * Lazy cleanup of expired rate limit entries
 * Runs on each request to prevent memory leaks in serverless environments
 * Only cleans up if store is getting large to minimize overhead
 */
function cleanupExpiredEntries() {
  const now = Date.now();
  // Only clean if we have more than 100 entries to minimize overhead
  if (rateLimitStore.size > 100) {
    for (const [key, data] of rateLimitStore.entries()) {
      if (now > data.resetTime) {
        rateLimitStore.delete(key);
      }
    }
  }
}

/**
 * Rate limiter middleware
 * @param {Object} options - Rate limit configuration
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.max - Maximum number of requests per window
 * @returns {Function} Rate limit checker function
 */
function createRateLimiter({ windowMs = 60000, max = 10 } = {}) {
  return (req) => {
    // Lazy cleanup to prevent memory leaks in serverless
    cleanupExpiredEntries();

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
               req.connection?.remoteAddress ||
               req.socket?.remoteAddress ||
               'unknown';

    const key = `ratelimit:${ip}`;
    const now = Date.now();

    let record = rateLimitStore.get(key);

    if (!record || now > record.resetTime) {
      // Create new record or reset expired one
      record = {
        count: 1,
        resetTime: now + windowMs,
        firstRequest: now
      };
      rateLimitStore.set(key, record);
      return { allowed: true, remaining: max - 1 };
    }

    if (record.count >= max) {
      // Rate limit exceeded
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      return {
        allowed: false,
        remaining: 0,
        retryAfter
      };
    }

    // Increment count
    record.count++;
    rateLimitStore.set(key, record);

    return {
      allowed: true,
      remaining: max - record.count
    };
  };
}

module.exports = { createRateLimiter };
