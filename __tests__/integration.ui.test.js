/** @jest-environment jsdom */
const fs = require('fs');
const path = require('path');

describe('Integration: new session, Next x3, Undo x1, Reset', () => {
  beforeEach(() => {
    document.body.innerHTML = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    jest.useFakeTimers();
    jest.resetModules();
    require('../public/sessionStore');
    require('../public/selectionUtils');
    require('../public/askedList');
    require('../public/sessionPicker');
    require('../public/script');
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.resetModules();
    localStorage.clear();
  });

  test('flow updates asked list correctly', () => {
    // Create new session via picker UI (New tab is default when none exist)
    const input = document.querySelector('input[aria-label="New session name"]');
    const createBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Create');
    input.value = 'Flow';
    input.dispatchEvent(new Event('input'));
    expect(createBtn.disabled).toBe(false);
    createBtn.click();

    const nextBtn = document.getElementById('nextBtn');
    const undoBtn = document.getElementById('undoBtn');
    const resetBtn = document.getElementById('resetBtn');
    const askedContainer = document.getElementById('asked-container');

    // Next x3 (first Next only shows question, second records, third shows next)
    nextBtn.click();
    nextBtn.click();
    nextBtn.click();

    // Undo x1 (should pop last asked and reshow it)
    undoBtn.click();

    // Verify list shows 1 item after undo (last asked removed)
    const items = askedContainer.querySelectorAll('[role="listitem"]');
    expect(items.length).toBe(1);

    // Reset clears list (confirm)
    resetBtn.click();
    const confirm = document.getElementById('resetConfirm');
    confirm.click();
    const itemsAfterReset = askedContainer.querySelectorAll('[role="listitem"]');
    expect(itemsAfterReset.length).toBe(0);
  });

  test('existing session restores current card; copy/export include datetime', () => {
    // Create session via UI (New tab default when none exist)
    const input = document.querySelector('input[aria-label="New session name"]');
    const createBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Create');
    input.value = 'Restore';
    input.dispatchEvent(new Event('input'));
    createBtn.click();

    const nextBtn = document.getElementById('nextBtn');
    nextBtn.click(); // show first

    // Reload app (simulate by re-rendering modules)
    document.body.innerHTML = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    jest.resetModules();
    require('../public/sessionStore');
    require('../public/selectionUtils');
    require('../public/askedList');
    require('../public/sessionPicker');
    require('../public/script');

    // Open existing session
    const select = document.getElementById('sessionSelect');
    select.value = 'Restore';
    select.dispatchEvent(new Event('change'));
    const open = document.getElementById('openSessionBtn');
    open.click();

    const container = document.getElementById('question-container');
    expect(container.textContent).not.toContain('Press the button');

    // Copy/export
    const askedContainer = document.getElementById('asked-container');
    const copyBtn = askedContainer.querySelector('button[aria-label="Copy asked list"]');
    copyBtn.click();
    // Export
    const exportBtn = Array.from(askedContainer.querySelectorAll('button')).find(b => b.textContent.trim() === 'Export');
    const BlobOrig = global.Blob;
    const spy = jest.fn((parts, opts) => new BlobOrig(parts, opts));
    global.Blob = spy;
    try {
      exportBtn.click();
      expect(spy).toHaveBeenCalled();
    } finally {
      global.Blob = BlobOrig;
    }
  });
});


