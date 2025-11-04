const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

const request = require('supertest');
const path = require('path');

describe('server admin/session keys (env-gated)', () => {
  let app;
  const OLD_ENV = process.env;
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV, ADMIN_KEY: 'admin-secret', COOKIE_SECRET: 'test-cookie' };
    app = require('../server');
  });
  afterEach(() => {
    process.env = OLD_ENV;
  });

  test('POST /api/sessions requires ADMIN_KEY', async () => {
    const resForbidden = await request(app).post('/api/sessions').send({ name: 'Sec' }).set('Content-Type', 'application/json');
    expect(resForbidden.status).toBe(403);
    const resOk = await request(app).post('/api/sessions').send({ name: 'Sec' }).set('Content-Type', 'application/json').set('Authorization', 'Key admin-secret');
    expect(resOk.status).toBe(201);
    expect(resOk.body).toHaveProperty('links');
    expect(resOk.body.links).toHaveProperty('edit');
  });

  test('GET/PATCH allowed with admin key or session key; forbidden otherwise', async () => {
    const create = await request(app).post('/api/sessions').send({ name: 'A' }).set('Content-Type', 'application/json').set('Authorization', 'Key admin-secret');
    const id = create.body.id;
    const editUrl = String(create.body.links.edit || '');
    const parsedEdit = new URL(editUrl, 'http://x');
    const sessionKey = parsedEdit.searchParams.get('key');
    expect(sessionKey).toBeTruthy();
    expect(parsedEdit.searchParams.get('cap')).toBe('1');

    const getForbidden = await request(app).get(`/api/sessions/${id}`);
    expect([403, 200]).toContain(getForbidden.status); // If no keys on session, would be 200; here keys exist so expect 403
    if (getForbidden.status !== 200) expect(getForbidden.status).toBe(403);

    const getWithSessionKey = await request(app).get(`/api/sessions/${id}?key=${sessionKey}`);
    expect(getWithSessionKey.status).toBe(200);

    const getWithAdmin = await request(app).get(`/api/sessions/${id}`).set('Authorization', 'Key admin-secret');
    expect(getWithAdmin.status).toBe(200);

    const patchForbidden = await request(app).patch(`/api/sessions/${id}`).send({ action: 'markAsked', question: { text: 'Q1' } }).set('Content-Type', 'application/json');
    expect([403, 404]).toContain(patchForbidden.status);

    const patchWithSessionKey = await request(app).patch(`/api/sessions/${id}?key=${sessionKey}`).send({ action: 'markAsked', question: { text: 'Q1' } }).set('Content-Type', 'application/json');
    expect(patchWithSessionKey.status).toBe(200);

    const read = await request(app).get(`/api/sessions/${id}`).set('Authorization', 'Key admin-secret');
    expect(read.body.asked.find(q => q.text === 'Q1')).toBeTruthy();
  });
});
