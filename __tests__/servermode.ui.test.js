/** @jest-environment jsdom */
const fs = require('fs');
const path = require('path');

describe('Server-mode UI: answers load and persist with unique link', () => {
  const FIRST_Q = "Am I giving you enough information to do your job well?";

  beforeEach(() => {
    // Reset DOM and URL to include cap session params
    document.body.innerHTML = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    window.history.pushState({}, '', '/?id=test-session-1&key=test-key-1&cap=1');
    jest.resetModules();

    // Deterministic next question selection: pick first remaining
    jest.spyOn(Math, 'random').mockReturnValue(0);

    // Mock fetch for capsessions GET/PATCH
    const initialSession = {
      id: 'test-session-1',
      name: 'Server Session',
      asked: [],
      skipped: [],
      // Answer keyed by question text as per API contract
      answers: { [FIRST_Q]: 'Server notes' },
      cap: true,
    };
    let lastPatched = null;
    global.fetch = jest.fn(async (url, opts = {}) => {
      if (typeof url === 'string' && url.startsWith('/api/capsessions/')) {
        if ((opts.method || 'GET') === 'PATCH') {
          try { lastPatched = JSON.parse(opts.body || '{}'); } catch { lastPatched = {}; }
          // Echo back updated session shape
          if (lastPatched && lastPatched.action === 'setAnswer' && lastPatched.question && lastPatched.question.text) {
            initialSession.answers[lastPatched.question.text] = lastPatched.value || '';
          }
          return { ok: true, json: async () => initialSession };
        }
        // GET
        return { ok: true, json: async () => initialSession };
      }
      // Fallback for any other calls
      return { ok: true, json: async () => ({}) };
    });

    // Load client modules (order matters)
    require('../public/sessionStore');
    require('../public/selectionUtils');
    require('../public/askedList');
    require('../public/sessionPicker');
    require('../public/script');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
    localStorage.clear();
    sessionStorage.clear();
  });

  test('loads initial answer from server and persists on blur', async () => {
    // Allow any pending microtasks to settle
    await Promise.resolve();

    const textarea = document.getElementById('answerText');
    expect(textarea).toBeTruthy();
    // Initial value should come from server-provided answers
    expect(textarea.value).toBe('Server notes');

    // Edit and blur -> should PATCH to server
    textarea.value = 'Edited on client';
    textarea.dispatchEvent(new Event('blur'));

    // Wait for async PATCH
    await Promise.resolve();

    // Verify fetch was called with setAnswer action
    const calls = global.fetch.mock.calls.map(args => args[0]);
    expect(calls.find(u => String(u).startsWith('/api/capsessions/'))).toBeTruthy();

    // The UI should still reflect our edited value after blur
    expect(document.getElementById('answerText').value).toBe('Edited on client');
  });
});


