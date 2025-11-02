/**
 * Shared session action handlers
 * Consolidates the logic for applying different actions to sessions
 */

const { validateAnswer, validateQuestionText, validateTheme } = require('./_validation');

/**
 * Apply an action to a session
 * @param {Object} session - Session object to modify
 * @param {string} action - Action type
 * @param {Object} question - Question object (with text and optional theme)
 * @param {string} value - Value for setAnswer action
 * @returns {Object} Modified session or error object { error: string }
 */
function applySessionAction(session, action, question, value = '') {
  if (!session) return null;

  switch (action) {
    case 'markAsked':
      if (question && question.text) {
        // Validate question text
        const questionValidation = validateQuestionText(question.text);
        if (!questionValidation.valid) {
          return { error: questionValidation.error };
        }

        const validatedQuestion = { text: questionValidation.sanitized };
        if (question.theme) {
          const themeValidation = validateTheme(question.theme);
          if (!themeValidation.valid) {
            return { error: themeValidation.error };
          }
          if (themeValidation.sanitized) {
            validatedQuestion.theme = themeValidation.sanitized;
          }
        }

        session.asked.push(validatedQuestion);
        // If it was skipped earlier, remove the last matching skipped
        const skipIdx = session.skipped.findIndex(q => q.text === validatedQuestion.text);
        if (skipIdx !== -1) session.skipped.splice(skipIdx, 1);
      }
      break;

    case 'markSkipped':
      if (question && question.text) {
        // Validate question text
        const questionValidation = validateQuestionText(question.text);
        if (!questionValidation.valid) {
          return { error: questionValidation.error };
        }

        const validatedQuestion = { text: questionValidation.sanitized };
        if (question.theme) {
          const themeValidation = validateTheme(question.theme);
          if (!themeValidation.valid) {
            return { error: themeValidation.error };
          }
          if (themeValidation.sanitized) {
            validatedQuestion.theme = themeValidation.sanitized;
          }
        }

        session.skipped.push(validatedQuestion);
        const askIdx = session.asked.findIndex(q => q.text === validatedQuestion.text);
        if (askIdx !== -1) session.asked.splice(askIdx, 1);
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
      // Clear all saved answers on reset
      if (session.answers) {
        session.answers = {};
      }
      // Clear current question if it exists
      if (typeof session.currentQuestion !== 'undefined') {
        session.currentQuestion = null;
      }
      if (typeof session.currentQuestionId !== 'undefined') {
        session.currentQuestionId = null;
      }
      break;

    case 'setAnswer':
      // Ensure answers object exists
      if (!session.answers || typeof session.answers !== 'object') {
        session.answers = {};
      }
      if (question && question.text) {
        // Validate answer value
        const answerValidation = validateAnswer(value);
        if (!answerValidation.valid) {
          return { error: answerValidation.error };
        }

        // Validate question text
        const questionValidation = validateQuestionText(question.text);
        if (!questionValidation.valid) {
          return { error: questionValidation.error };
        }

        session.answers[questionValidation.sanitized] = answerValidation.sanitized;
      }
      break;

    case 'setCurrentQuestion':
      if (question && question.text) {
        // Validate question text
        const questionValidation = validateQuestionText(question.text);
        if (!questionValidation.valid) {
          return { error: questionValidation.error };
        }

        const next = { text: questionValidation.sanitized };

        // Validate theme if provided
        if (question.theme) {
          const themeValidation = validateTheme(question.theme);
          if (!themeValidation.valid) {
            return { error: themeValidation.error };
          }
          if (themeValidation.sanitized) {
            next.theme = themeValidation.sanitized;
          }
        }

        session.currentQuestion = next;
        if (question.id) {
          session.currentQuestionId = String(question.id);
        } else if (typeof session.currentQuestionId !== 'undefined') {
          session.currentQuestionId = null;
        }
      }
      break;

    default:
      // Invalid action, return session unchanged
      break;
  }

  // Update lastAccess if it exists
  if (typeof session.lastAccess !== 'undefined') {
    session.lastAccess = Date.now();
  }

  return session;
}

module.exports = { applySessionAction };
