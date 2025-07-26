const fs = require('fs');
const path = require('path');

describe('question generator UI', () => {
  let container;
  let button;

  beforeEach(() => {
    document.body.innerHTML = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    container = document.getElementById('question-container');
    button = document.getElementById('getQuestionBtn');
    jest.useFakeTimers();
    require('../public/script');
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.resetModules();
  });

  test('clicking button shows a question after delay', () => {
    button.click();
    expect(container.textContent).toContain('Finding your question');
    jest.runAllTimers();
    expect(container.textContent).not.toContain('Finding your question');
  });

  test('pulse class returns after delay', () => {
    button.classList.add('pulse');
    button.click();
    expect(button.classList.contains('pulse')).toBe(false);
    jest.advanceTimersByTime(2800); // 800ms loading + 2000ms pulse delay
    expect(button.classList.contains('pulse')).toBe(true);
  });
});
