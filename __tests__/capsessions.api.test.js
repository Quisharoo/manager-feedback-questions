const createHandler = require('../api/capsessions');
const idHandler = require('../api/capsessions/[id]');

function makeReq({ method = 'GET', url = '/', headers = {}, body = null, query = {} } = {}) {
  const listeners = {};
  const req = {
    method,
    url,
    headers,
    query,
    on(event, cb) {
      listeners[event] = cb;
      if (event === 'end') {
        setTimeout(() => {
          if (listeners['data'] && body != null) {
            const payload = typeof body === 'string' ? body : JSON.stringify(body);
            listeners['data'](payload);
          }
          cb();
        }, 0);
      }
    },
  };
  return req;
}

function makeRes() {
  let resolve;
  const done = new Promise(r => { resolve = r; });
  const headers = {};
  const res = {
    statusCode: 200,
    setHeader(name, value) { headers[name] = value; },
    getHeader(name) { return headers[name]; },
    end(data) { res.body = data; res.headers = headers; resolve(); },
  };
  res.done = done;
  return res;
}

function parseJson(res) {
  try { return JSON.parse(res.body || '{}'); } catch { return {}; }
}

describe('serverless /api/capsessions', () => {
  const OLD_ENV = process.env;
  beforeEach(() => { jest.resetModules(); process.env = { ...OLD_ENV }; });
  afterEach(() => { process.env = OLD_ENV; });

  test('POST create returns links; GET/PATCH require key', async () => {
    // Create without ADMIN_KEY requirement
    const createReq = makeReq({ method: 'POST', url: '/api/capsessions', headers: { 'content-type': 'application/json' }, body: { name: 'Cap A' } });
    const createRes = makeRes();
    await createHandler(createReq, createRes);
    await createRes.done;
    expect(createRes.statusCode).toBe(201);
    const created = parseJson(createRes);
    expect(typeof created.id).toBe('string');
    expect(created.links && created.links.edit).toBeTruthy();
    const url = new URL(created.links.edit, 'http://x');
    const id = created.id;
    const key = url.searchParams.get('key');
    expect(key).toBeTruthy();

    // GET without key forbidden
    const getForbiddenReq = makeReq({ method: 'GET', url: `/api/capsessions/${id}`, query: { id } });
    const getForbiddenRes = makeRes();
    await idHandler(getForbiddenReq, getForbiddenRes);
    await getForbiddenRes.done;
    expect(getForbiddenRes.statusCode).toBe(403);

    // GET with key ok
    const getReq = makeReq({ method: 'GET', url: `/api/capsessions/${id}?key=${key}`, query: { id, key } });
    const getRes = makeRes();
    await idHandler(getReq, getRes);
    await getRes.done;
    expect(getRes.statusCode).toBe(200);

    // PATCH markAsked with key
    const q = { text: 'Hello world?' };
    const patchReq = makeReq({ method: 'PATCH', url: `/api/capsessions/${id}?key=${key}`, headers: { 'content-type': 'application/json' }, body: { action: 'markAsked', question: q }, query: { id, key } });
    const patchRes = makeRes();
    await idHandler(patchReq, patchRes);
    await patchRes.done;
    expect(patchRes.statusCode).toBe(200);
    const updated = parseJson(patchRes);
    expect(updated.asked.find(x => x.text === q.text)).toBeTruthy();

    // PATCH setAnswer with key
    const ansReq = makeReq({ method: 'PATCH', url: `/api/capsessions/${id}?key=${key}`, headers: { 'content-type': 'application/json' }, body: { action: 'setAnswer', question: q, value: 'My notes' }, query: { id, key } });
    const ansRes = makeRes();
    await idHandler(ansReq, ansRes);
    await ansRes.done;
    expect(ansRes.statusCode).toBe(200);

    // GET again to verify answer saved
    const get2Req = makeReq({ method: 'GET', url: `/api/capsessions/${id}?key=${key}`, query: { id, key } });
    const get2Res = makeRes();
    await idHandler(get2Req, get2Res);
    await get2Res.done;
    const body = parseJson(get2Res);
    expect(body.answers && body.answers[q.text]).toBe('My notes');

    // Reset clears asked and answers
    const resetReq = makeReq({ method: 'PATCH', url: `/api/capsessions/${id}?key=${key}`, headers: { 'content-type': 'application/json' }, body: { action: 'reset' }, query: { id, key } });
    const resetRes = makeRes();
    await idHandler(resetReq, resetRes);
    await resetRes.done;
    expect(resetRes.statusCode).toBe(200);
    const afterReset = parseJson(resetRes);
    expect(Array.isArray(afterReset.asked) && afterReset.asked.length).toBe(0);
    expect(afterReset.answers && Object.keys(afterReset.answers).length).toBe(0);
  });

  test('GET returns 403 for session missing editKeyHash (security)', async () => {
    // Simulate a corrupted/legacy session missing editKeyHash
    const store = require('../api/_store');
    const sessionWithoutHash = await store.createSession('Legacy', {});
    expect(sessionWithoutHash.editKeyHash).toBeUndefined();

    // Attempt to access without key should return 403, not 200
    const getReq = makeReq({ method: 'GET', url: `/api/capsessions/${sessionWithoutHash.id}`, query: { id: sessionWithoutHash.id } });
    const getRes = makeRes();
    await idHandler(getReq, getRes);
    await getRes.done;
    expect(getRes.statusCode).toBe(403);
  });
});


