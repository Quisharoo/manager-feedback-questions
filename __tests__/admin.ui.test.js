/** @jest-environment jsdom */
const fs = require('fs');
const path = require('path');

describe('Admin UI', () => {
  function loadWithUrl(url) {
    // jsdom sets location via window.location; we can override by creating a new document with base.
    // Simpler: patch window.location.href using defineProperty
    delete window.location;
    window.location = new URL(url);
  }

  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    // load dependencies in the same order as index.html
    require('../public/sessionStore');
    require('../public/selectionUtils');
    require('../public/askedList');
    require('../public/sessionPicker');
  });

  afterEach(() => {
    jest.resetModules();
    sessionStorage.clear();
  });

  test('auto-inits on ?admin=1 and shows modal when no key', async () => {
    loadWithUrl('https://example.com/?admin=1');
    // Stub fetch to fail first (invalid key check), but modal opens before fetch
    global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
    require('../public/script');
    const banner = document.getElementById('adminBanner');
    expect(banner.classList.contains('hidden')).toBe(false);
    // Modal present
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
  });

  test('persists key and validates silently on return visit', async () => {
    loadWithUrl('https://example.com/?admin=1');
    // First visit: open modal and enter key, which validates
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ sessions: [{ name: 'S' }] }) });
    require('../public/script');
    // Enter a key and submit
    const input = document.getElementById('adminKeyInput');
    const confirm = document.getElementById('adminConfirm');
    input.value = 'secret';
    confirm.click();
    // Wait for async validation -> storage set
    await new Promise(r => setTimeout(r, 0));
    expect(sessionStorage.getItem('mfq_admin_key')).toBe('secret');

    // Simulate reload with same URL; should not show modal when fetch ok
    document.body.innerHTML = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    jest.resetModules();
    require('../public/sessionStore');
    require('../public/selectionUtils');
    require('../public/askedList');
    require('../public/sessionPicker');
    loadWithUrl('https://example.com/?admin=1');
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ sessions: [] }) });
    require('../public/script');
    // No admin modal this time (session gate dialog may exist)
    const adminInput = document.getElementById('adminKeyInput');
    expect(adminInput).toBeFalsy();
  });
});


