/**
 * Input validation utilities
 */

const MAX_SESSION_NAME_LENGTH = 100;
const SESSION_NAME_PATTERN = /^[a-zA-Z0-9\s\-_.,()&]+$/;

/**
 * Validate session name
 * @param {string} name - Session name to validate
 * @returns {Object} { valid: boolean, error?: string, sanitized?: string }
 */
function validateSessionName(name) {
  // Check if name is a string
  if (typeof name !== 'string') {
    return { valid: false, error: 'Name must be a string' };
  }

  // Trim whitespace
  const trimmed = name.trim();

  // Check if empty
  if (!trimmed || trimmed.length === 0) {
    return { valid: false, error: 'Name cannot be empty' };
  }

  // Check length
  if (trimmed.length > MAX_SESSION_NAME_LENGTH) {
    return { valid: false, error: `Name must be ${MAX_SESSION_NAME_LENGTH} characters or less` };
  }

  // Check for valid characters (alphanumeric, spaces, and common punctuation)
  if (!SESSION_NAME_PATTERN.test(trimmed)) {
    return { valid: false, error: 'Name contains invalid characters. Only letters, numbers, spaces, and .-_,()& are allowed' };
  }

  return { valid: true, sanitized: trimmed };
}

module.exports = {
  validateSessionName,
  MAX_SESSION_NAME_LENGTH,
  SESSION_NAME_PATTERN
};
