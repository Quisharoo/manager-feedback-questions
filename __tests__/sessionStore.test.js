/** @jest-environment jsdom */
const SessionStore = require('../public/sessionStore');

describe('SessionStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('creates and lists sessions', () => {
    expect(SessionStore.getAll()).toEqual([]);
    SessionStore.create('A');
    SessionStore.create('B');
    expect(SessionStore.getAll()).toEqual(['B', 'A']);
    expect(SessionStore.exists('A')).toBe(true);
  });

  test('persists askedIds and undo/reset', () => {
    SessionStore.create('Run');
    SessionStore.addAsked('Run', 'q1');
    SessionStore.addAsked('Run', 'q2');
    let s = SessionStore.open('Run');
    expect(s.askedIds).toEqual(['q1', 'q2']);
    const last = SessionStore.removeLastAsked('Run');
    expect(last).toBe('q2');
    s = SessionStore.open('Run');
    expect(s.askedIds).toEqual(['q1']);
    SessionStore.reset('Run');
    s = SessionStore.open('Run');
    expect(s.askedIds).toEqual([]);
  });

  test('migrates and persists currentId/currentViewedAt; setCurrent updates', () => {
    localStorage.setItem('session:C1', JSON.stringify({ name: 'C1', askedIds: [], timestamps: [] }));
    let s = SessionStore.open('C1');
    expect(s.currentId).toBeNull();
    expect(typeof s.currentViewedAt).toBe('number');
    s = SessionStore.setCurrent('C1', 'abc');
    expect(s.currentId).toBe('abc');
    const again = SessionStore.open('C1');
    expect(again.currentId).toBe('abc');
    expect(again.currentViewedAt).toBeGreaterThan(0);
  });

  test('migration merges legacy asked/skipped arrays', () => {
    localStorage.setItem('session:Legacy', JSON.stringify({ name: 'Legacy', asked: [{ id: 'a' }], skipped: [{ id: 'b' }], askedIds: ['c'] }));
    const s = SessionStore.open('Legacy');
    expect(new Set(s.askedIds)).toEqual(new Set(['a', 'b', 'c']));
  });
});


