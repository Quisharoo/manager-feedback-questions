/**
 * Input validation utilities
 */

const MAX_SESSION_NAME_LENGTH = 100;
const SESSION_NAME_PATTERN = /^[a-zA-Z0-9\s\-_.,()&:]+$/;

// Answer validation limits
const MAX_ANSWER_LENGTH = 10000; // 10KB max for answer values
const MAX_QUESTION_TEXT_LENGTH = 1000; // 1KB max for question text
const MAX_THEME_LENGTH = 100; // 100 chars max for theme

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
    return { valid: false, error: 'Name contains invalid characters. Only letters, numbers, spaces, and .-_,()&: are allowed' };
  }

  return { valid: true, sanitized: trimmed };
}

/**
 * Validate answer value
 * @param {string} value - Answer value to validate
 * @returns {Object} { valid: boolean, error?: string, sanitized?: string }
 */
function validateAnswer(value) {
  // Check if value is a string
  if (typeof value !== 'string') {
    return { valid: false, error: 'Answer must be a string' };
  }

  // Check length (10KB max to prevent abuse)
  if (value.length > MAX_ANSWER_LENGTH) {
    return { valid: false, error: `Answer must be ${MAX_ANSWER_LENGTH} characters or less` };
  }

  return { valid: true, sanitized: value };
}

/**
 * Validate question text
 * @param {string} text - Question text to validate
 * @returns {Object} { valid: boolean, error?: string, sanitized?: string }
 */
function validateQuestionText(text) {
  // Check if text is a string
  if (typeof text !== 'string') {
    return { valid: false, error: 'Question text must be a string' };
  }

  const trimmed = text.trim();

  // Check if empty
  if (!trimmed || trimmed.length === 0) {
    return { valid: false, error: 'Question text cannot be empty' };
  }

  // Check length
  if (trimmed.length > MAX_QUESTION_TEXT_LENGTH) {
    return { valid: false, error: `Question text must be ${MAX_QUESTION_TEXT_LENGTH} characters or less` };
  }

  return { valid: true, sanitized: trimmed };
}

/**
 * Validate question theme
 * @param {string} theme - Theme to validate
 * @returns {Object} { valid: boolean, error?: string, sanitized?: string }
 */
function validateTheme(theme) {
  // Theme is optional
  if (!theme) {
    return { valid: true, sanitized: null };
  }

  // Check if theme is a string
  if (typeof theme !== 'string') {
    return { valid: false, error: 'Theme must be a string' };
  }

  const trimmed = theme.trim();

  // Check length
  if (trimmed.length > MAX_THEME_LENGTH) {
    return { valid: false, error: `Theme must be ${MAX_THEME_LENGTH} characters or less` };
  }

  return { valid: true, sanitized: trimmed || null };
}

/**
 * Validate question object (wrapper for compatibility)
 * @param {Object} question - Question object with text and optional theme
 * @returns {Object} { valid: boolean, error?: string }
 */
function validateQuestion(question) {
  if (!question || typeof question !== 'object') {
    return { valid: false, error: 'Question must be an object' };
  }

  const textValidation = validateQuestionText(question.text);
  if (!textValidation.valid) {
    return textValidation;
  }

  if (question.theme) {
    const themeValidation = validateTheme(question.theme);
    if (!themeValidation.valid) {
      return themeValidation;
    }
  }

  return { valid: true };
}

/**
 * Validate answer value (wrapper for compatibility)
 * @param {string} value - Answer value to validate
 * @returns {Object} { valid: boolean, error?: string, sanitized?: string }
 */
function validateAnswerValue(value) {
  return validateAnswer(value);
}

module.exports = {
  validateSessionName,
  validateAnswer,
  validateQuestionText,
  validateTheme,
  validateQuestion,
  validateAnswerValue,
  MAX_SESSION_NAME_LENGTH,
  SESSION_NAME_PATTERN,
  MAX_ANSWER_LENGTH,
  MAX_QUESTION_TEXT_LENGTH,
  MAX_THEME_LENGTH
};
