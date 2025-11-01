/**
 * Shared session action handlers
 * Consolidates the logic for applying different actions to sessions
 */

/**
 * Apply an action to a session
 * @param {Object} session - Session object to modify
 * @param {string} action - Action type
 * @param {Object} question - Question object (with text and optional theme)
 * @param {string} value - Value for setAnswer action
 * @returns {Object} Modified session
 */
function applySessionAction(session, action, question, value = '') {
  if (!session) return null;

  switch (action) {
    case 'markAsked':
      if (question && question.text) {
        session.asked.push(question);
        // If it was skipped earlier, remove the last matching skipped
        const skipIdx = session.skipped.findIndex(q => q.text === question.text);
        if (skipIdx !== -1) session.skipped.splice(skipIdx, 1);
      }
      break;

    case 'markSkipped':
      if (question && question.text) {
        session.skipped.push(question);
        const askIdx = session.asked.findIndex(q => q.text === question.text);
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
        session.answers[String(question.text)] = value;
      }
      break;

    case 'setCurrentQuestion':
      if (question && question.text) {
        const next = { text: String(question.text) };
        if (question.theme) next.theme = question.theme;
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
