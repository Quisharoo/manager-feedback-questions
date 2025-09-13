const createHandler = require('../api/sessions');
const idHandler = require('../api/sessions/[id]');

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
        // emit after data
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
    setHeader(name, value) {
      const key = name;
      if (key.toLowerCase() === 'set-cookie') {
        if (headers[key]) {
          headers[key] = Array.isArray(headers[key]) ? headers[key].concat(value) : [headers[key], value];
        } else {
          headers[key] = value;
        }
      } else {
        headers[key] = value;
      }
    },
    getHeader(name) {
      return headers[name];
    },
    end(data) {
      res.body = data;
      res.headers = headers;
      resolve();
    },
  };
  res.done = done;
  return res;
}

function parseJson(res) {
  try {
    return JSON.parse(res.body || '{}');
  } catch {
    return {};
  }
}

describe('serverless /api/sessions handlers', () => {
  test('POST create returns 201 with session and sets cookie', async () => {
    const req = makeReq({ method: 'POST', url: '/api/sessions', headers: { 'content-type': 'application/json' }, body: { name: 'Alice' } });
    const res = makeRes();
    await createHandler(req, res);
    await res.done;
    expect(res.statusCode).toBe(201);
    const json = parseJson(res);
    expect(typeof json.id).toBe('string');
    expect(json).toMatchObject({ name: 'Alice', asked: [], skipped: [] });
    const setCookie = res.headers['Set-Cookie'];
    expect(setCookie).toBeTruthy();
  });

  test('POST create returns 400 on invalid name', async () => {
    const req = makeReq({ method: 'POST', url: '/api/sessions', headers: { 'content-type': 'application/json' }, body: {} });
    const res = makeRes();
    await createHandler(req, res);
    await res.done;
    expect(res.statusCode).toBe(400);
  });

  test('GET and PATCH use cookie-based session persistence', async () => {
    // Create
    const createReq = makeReq({ method: 'POST', url: '/api/sessions', headers: { 'content-type': 'application/json' }, body: { name: 'Cookie Persist' } });
    const createRes = makeRes();
    await createHandler(createReq, createRes);
    await createRes.done;
    const created = parseJson(createRes);
    const id = created.id;
    const setCookie = Array.isArray(createRes.headers['Set-Cookie']) ? createRes.headers['Set-Cookie'][0] : createRes.headers['Set-Cookie'];
    const cookiePair = (setCookie || '').split(';')[0];

    // GET with Cookie
    const getReq = makeReq({ method: 'GET', url: `/api/sessions/${id}`, headers: { cookie: cookiePair }, query: { id } });
    const getRes = makeRes();
    await idHandler(getReq, getRes);
    await getRes.done;
    expect(getRes.statusCode).toBe(200);
    const got = parseJson(getRes);
    expect(got).toMatchObject({ id, name: 'Cookie Persist', asked: [], skipped: [] });

    // PATCH markAsked
    const q = { theme: 'X', text: 'Hello' };
    const patchReq = makeReq({ method: 'PATCH', url: `/api/sessions/${id}`, headers: { 'content-type': 'application/json', cookie: cookiePair }, body: { action: 'markAsked', question: q }, query: { id } });
    const patchRes = makeRes();
    await idHandler(patchReq, patchRes);
    await patchRes.done;
    expect(patchRes.statusCode).toBe(200);
    const updated = parseJson(patchRes);
    expect(updated.asked).toEqual([q]);
  });
});


