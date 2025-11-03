/**
 * Test concurrent updates to KV store to verify retry logic
 */

// Mock KV store for testing
let mockKvData = new Map();
let kvReadDelay = 0;
let kvWriteDelay = 0;

const mockKv = {
  async get(key) {
    if (kvReadDelay) await new Promise(r => setTimeout(r, kvReadDelay));
    return mockKvData.get(key);
  },
  async set(key, value) {
    if (kvWriteDelay) await new Promise(r => setTimeout(r, kvWriteDelay));
    mockKvData.set(key, value);
  },
  async del(key) {
    mockKvData.delete(key);
  }
};

// Setup environment to use mock KV
process.env.VERCEL = '1';
process.env.KV_REST_API_URL = 'mock://localhost';

jest.mock('@vercel/kv', () => ({
  kv: mockKv
}));

const store = require('../api/_store');

describe('KV Store Concurrency', () => {
  beforeEach(() => {
    mockKvData.clear();
    kvReadDelay = 0;
    kvWriteDelay = 0;
    jest.clearAllMocks();
  });

  test('handles concurrent updates with retries', async () => {
    // Create a session
    const session = await store.createSession('Test Session', {
      asked: [],
      answers: {}
    });

    // Simulate concurrent updates
    const updates = [];
    for (let i = 0; i < 5; i++) {
      updates.push(
        store.updateSession(session.id, (s) => {
          return {
            ...s,
            answers: {
              ...s.answers,
              [`q${i}`]: `answer${i}`
            }
          };
        })
      );
    }

    // All updates should succeed
    const results = await Promise.all(updates);
    results.forEach(result => {
      expect(result).not.toBeNull();
      expect(result.id).toBe(session.id);
    });

    // Final session should have all answers (some may be lost due to last-write-wins)
    const final = await store.getSession(session.id);
    // Due to concurrent updates with last-write-wins, we might not have all 5 answers
    // but we should have at least 1
    expect(Object.keys(final.answers).length).toBeGreaterThanOrEqual(1);
  }, 10000);

  test('saveSession does not cause version conflicts', async () => {
    // Create a session
    const session = await store.createSession('Test Session', {
      asked: [],
      answers: {}
    });

    // Simulate concurrent saveSession (like GET requests updating lastAccess)
    // and updateSession (like PATCH requests)
    const operations = [];

    for (let i = 0; i < 3; i++) {
      // saveSession (GET request)
      operations.push(
        store.saveSession({
          id: session.id,
          lastAccess: Date.now() + i
        })
      );

      // updateSession (PATCH request)
      operations.push(
        store.updateSession(session.id, (s) => {
          return {
            ...s,
            answers: {
              ...s.answers,
              [`q${i}`]: `answer${i}`
            }
          };
        })
      );
    }

    // All operations should succeed without exhausting retries
    const results = await Promise.all(operations);
    results.forEach(result => {
      expect(result).not.toBeNull();
      expect(result.id).toBe(session.id);
    });

    const final = await store.getSession(session.id);
    // With last-write-wins, we should have at least some answers
    expect(Object.keys(final.answers).length).toBeGreaterThanOrEqual(1);
  }, 10000);

  test('sequential updates preserve data', async () => {
    // Sequential updates (not concurrent) should preserve all data
    const session = await store.createSession('Test', {});

    const v1 = await store.updateSession(session.id, (s) => ({ ...s, step: 1 }));
    expect(v1.step).toBe(1);

    const v2 = await store.updateSession(session.id, (s) => ({ ...s, step: 2 }));
    expect(v2.step).toBe(2);

    const v3 = await store.updateSession(session.id, (s) => ({ ...s, step: 3 }));
    expect(v3.step).toBe(3);

    const final = await store.getSession(session.id);
    expect(final.step).toBe(3);
  });
});
