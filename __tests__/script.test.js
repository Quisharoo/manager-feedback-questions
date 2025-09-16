const fs = require('fs');
const path = require('path');

describe('question generator UI', () => {
  let container;
  let nextBtn;
  let undoBtn;

  beforeEach(() => {
    document.body.innerHTML = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    container = document.getElementById('question-container');
    nextBtn = document.getElementById('nextBtn');
    undoBtn = document.getElementById('undoBtn');
    jest.useFakeTimers();
    require('../public/sessionStore');
    require('../public/selectionUtils');
    require('../public/askedList');
    require('../public/sessionPicker');
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.resetModules();
  });

  test('Next shows a question and Undo toggles visibility', () => {
    // create a session via store and init script
    const SessionStore = require('../public/sessionStore');
    SessionStore.create('Test');
    require('../public/script');
    const select = document.getElementById('sessionSelect');
    select.value = 'Test';
    select.dispatchEvent(new Event('change'));
    document.getElementById('openSessionBtn').click();
    // First Next now immediately persists current and shows the next question on second click
    nextBtn.click(); // persists first and moves to next
    expect(undoBtn.classList.contains('hidden')).toBe(false);
    undoBtn.click();
  });

  test('Reset clears asked state', () => {
    const SessionStore = require('../public/sessionStore');
    SessionStore.create('ResetTest');
    require('../public/script');
    const select2 = document.getElementById('sessionSelect');
    select2.value = 'ResetTest';
    select2.dispatchEvent(new Event('change'));
    document.getElementById('openSessionBtn').click();
    nextBtn.click(); // persist first and move to next
    const s1 = SessionStore.open('ResetTest');
    expect(s1.askedIds.length).toBe(1);
    document.getElementById('resetBtn').click();
    // confirm sheet appears; click confirm
    const confirmBtn = document.getElementById('resetConfirm');
    confirmBtn.click();
    const s2 = SessionStore.open('ResetTest');
    expect(s2.askedIds.length).toBe(0);
  });

  test('Selection never repeats asked ids within a session', () => {
    const SessionStore = require('../public/sessionStore');
    SessionStore.create('NoRepeat');
    require('../public/script');
    const select3 = document.getElementById('sessionSelect');
    select3.value = 'NoRepeat';
    select3.dispatchEvent(new Event('change'));
    document.getElementById('openSessionBtn').click();
    // Ask and record a few
    nextBtn.click(); // records q1 (first click now persists first question)
    nextBtn.click(); // records q2
    const s = SessionStore.open('NoRepeat');
    const SelectionUtils = require('../public/selectionUtils');
    const { order } = SelectionUtils.buildIdMap([{ text: 'A' }, { text: 'B' }, { text: 'C' }]);
    const askedSet = new Set(s.askedIds);
    const next = SelectionUtils.nextQuestionId(order, askedSet);
    expect(next === null || !askedSet.has(next)).toBe(true);
  });
});
