const express = require('express');
const path = require('path');
const { createSession, getSession, saveSession, updateSession } = require('./server/sessionStore');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- API ---
app.post('/api/sessions', (req, res) => {
  const name = (req.body && typeof req.body.name === 'string' && req.body.name.trim()) || null;
  const session = createSession(name || '');
  res.status(201).json(session);
});

app.get('/api/sessions/:id', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Not found' });
  res.json(session);
});

// PATCH operations mutate a session's asked/skipped arrays.
// We use updateSession to serialize concurrent writes for the same session id.
app.patch('/api/sessions/:id', async (req, res) => {
  const id = req.params.id;
  const action = req.body && req.body.action;
  const question = req.body && req.body.question; // { theme, text }

  const updated = await updateSession(id, (session) => {
    if (!session) return null;
    switch (action) {
      case 'markAsked':
        if (question && question.text) {
          session.asked.push(question);
          // If it was skipped earlier, remove the last matching skipped
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
        // invalid action, return session unchanged
        break;
    }
    return session;
  }).catch((e) => null);

  if (!updated) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.json(updated);
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
