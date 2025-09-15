/** @jest-environment jsdom */
const fs = require('fs');
const path = require('path');

describe('SessionPicker sanitization and visibility', () => {
  beforeEach(() => {
    document.body.innerHTML = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    jest.resetModules();
    // Preload modules
    require('../public/sessionStore');
    require('../public/selectionUtils');
    require('../public/askedList');
    require('../public/sessionPicker');
    require('../public/script');
  });

  afterEach(() => {
    jest.resetModules();
    localStorage.clear();
  });

  test('hides Existing tab when index contains empty/whitespace entries', () => {
    // Corrupt index
    localStorage.setItem('sessions:index', JSON.stringify(['', '   ']));
    // Relock to re-render picker with sanitized list
    const evt = new Event('click');
    // Simulate opening the gate again
    const overlay = document.getElementById('sessionGateOverlay');
    if (!overlay) {
      // force lock
      require('../public/script');
    }
    // Render picker anew
    const host = document.querySelector('#sessionGateOverlay #sessionGateHost');
    const SessionPicker = require('../public/sessionPicker');
    const SessionStore = require('../public/sessionStore');
    SessionPicker.render(host, { sessions: SessionStore.getAll() });

    const tabExisting = document.getElementById('tab-existing');
    const panelExisting = document.querySelector('[role="tabpanel"][aria-labelledby="tab-existing"]');
    const helper = document.getElementById('sessionPickerHelper');
    expect(tabExisting.classList.contains('hidden')).toBe(true);
    expect(panelExisting.classList.contains('hidden')).toBe(true);
    expect(helper.textContent).toMatch(/Create a new session to begin/);
  });

  test('shows Existing after a session is created', () => {
    // Create a valid session via SessionStore
    const SessionStore = require('../public/sessionStore');
    SessionStore.create('Sanity');
    const host = document.querySelector('#sessionGateOverlay #sessionGateHost');
    const SessionPicker = require('../public/sessionPicker');
    SessionPicker.render(host, { sessions: SessionStore.getAll() });
    const tabExisting = document.getElementById('tab-existing');
    expect(tabExisting.classList.contains('hidden')).toBe(false);
  });
});
