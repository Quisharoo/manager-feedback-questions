/** @jest-environment jsdom */

describe('AskedList', () => {
  let container;
  let AskedList;

  const questions = [
    { id: 'a', text: 'Alpha question' },
    { id: 'b', text: 'Beta question that is a bit longer than others' },
    { id: 'c', text: 'Gamma' },
  ];

  beforeEach(() => {
    jest.resetModules();
    container = document.createElement('div');
    document.body.appendChild(container);
    AskedList = require('../public/askedList');
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  function mapFromArray(arr) {
    const m = new Map();
    arr.forEach(q => m.set(q.id, q));
    return m;
  }

  test('renders items matching askedIds (most recent first)', () => {
    AskedList.render(container, { askedIds: ['a', 'c'], timestamps: [1,2], questionsById: mapFromArray(questions) });
    const items = container.querySelectorAll('[role="listitem"]');
    expect(items.length).toBe(2);
    // timestamp 2 (c) should come first by default
    expect(items[0].textContent).toContain('Gamma');
    expect(items[1].textContent).toContain('Alpha');
  });

  test('copy includes datetime; export adds datetime column', () => {
    const now = Date.now();
    AskedList.render(container, { askedIds: ['a'], timestamps: [now], questionsById: mapFromArray(questions) });
    const text = AskedList.copyToClipboard(container);
    expect(text).toMatch(/Alpha question/);
    expect(text).toMatch(/\d{2}/);
    // Spy Blob for export
    const BlobOrig = global.Blob;
    const spy = jest.fn((parts, opts) => new BlobOrig(parts, opts));
    global.Blob = spy;
    try {
      AskedList.exportMenu(container);
      expect(spy).toHaveBeenCalled();
      const args = spy.mock.calls[1] || spy.mock.calls[0];
      const content = (args && args[0] && args[0][0]) || '';
      expect(String(content)).toMatch(/datetime/);
    } finally {
      global.Blob = BlobOrig;
    }
  });

  test('filter hides non matching', () => {
    AskedList.render(container, { askedIds: ['a', 'b', 'c'], timestamps: [1,2,3], questionsById: mapFromArray(questions) });
    const input = container.querySelector('input[aria-label="Search asked questions"]');
    input.value = 'beta';
    input.dispatchEvent(new Event('input'));
    const items = Array.from(container.querySelectorAll('[role="listitem"]'));
    expect(items.length).toBe(1);
    expect(items[0].textContent.toLowerCase()).toContain('beta');
  });

  test('clicking item calls onSelect with id', () => {
    const onSelect = jest.fn();
    AskedList.render(container, { askedIds: ['b'], timestamps: [1], questionsById: mapFromArray(questions), onSelect });
    const item = container.querySelector('[role="listitem"]');
    item.click();
    expect(onSelect).toHaveBeenCalledWith('b');
  });
});



