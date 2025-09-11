const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../server');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

describe('sessions API', () => {
  beforeEach(() => {
    // Clean sessions data file between tests
    if (fs.existsSync(SESSIONS_FILE)) {
      fs.unlinkSync(SESSIONS_FILE);
    }
    if (fs.existsSync(DATA_DIR)) {
      // leave dir; server will recreate file
    }
  });

  test('Create → returns valid session', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({ name: 'Weekly 1:1 - Alice' })
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(typeof res.body.id).toBe('string');
    expect(res.body).toMatchObject({ name: 'Weekly 1:1 - Alice', asked: [], skipped: [] });
  });

  test('Read → returns saved state', async () => {
    const create = await request(app).post('/api/sessions').send({ name: 'Report Bob' }).set('Content-Type', 'application/json');
    const id = create.body.id;
    const read = await request(app).get(`/api/sessions/${id}`);
    expect(read.status).toBe(200);
    expect(read.body).toMatchObject({ id, name: 'Report Bob', asked: [], skipped: [] });
  });

  test('Update → asked questions persist', async () => {
    const create = await request(app).post('/api/sessions').send({ name: 'Persist' }).set('Content-Type', 'application/json');
    const id = create.body.id;
    const q = { theme: 'Work Style', text: 'Is there a decision you disagreed with?' };
    const upd = await request(app).patch(`/api/sessions/${id}`).send({ action: 'markAsked', question: q }).set('Content-Type', 'application/json');
    expect(upd.status).toBe(200);
    expect(upd.body.asked).toEqual([q]);

    // Read again from disk
    const read = await request(app).get(`/api/sessions/${id}`);
    expect(read.body.asked).toEqual([q]);
  });

  test('Undo → removes last asked', async () => {
    const create = await request(app).post('/api/sessions').send({ name: 'Undo' }).set('Content-Type', 'application/json');
    const id = create.body.id;
    const q1 = { theme: 'A', text: 'Q1' };
    const q2 = { theme: 'B', text: 'Q2' };
    await request(app).patch(`/api/sessions/${id}`).send({ action: 'markAsked', question: q1 }).set('Content-Type', 'application/json');
    await request(app).patch(`/api/sessions/${id}`).send({ action: 'markAsked', question: q2 }).set('Content-Type', 'application/json');
    const undo = await request(app).patch(`/api/sessions/${id}`).send({ action: 'undoAsked' }).set('Content-Type', 'application/json');
    expect(undo.body.asked).toEqual([q1]);
  });

  test('Reset → clears progress', async () => {
    const create = await request(app).post('/api/sessions').send({ name: 'Reset' }).set('Content-Type', 'application/json');
    const id = create.body.id;
    const q1 = { theme: 'A', text: 'Q1' };
    await request(app).patch(`/api/sessions/${id}`).send({ action: 'markAsked', question: q1 }).set('Content-Type', 'application/json');
    const reset = await request(app).patch(`/api/sessions/${id}`).send({ action: 'reset' }).set('Content-Type', 'application/json');
    expect(reset.body.asked).toEqual([]);
    expect(reset.body.skipped).toEqual([]);
  });

  test('Not found → returns 404', async () => {
    const res = await request(app).get('/api/sessions/does-not-exist');
    expect(res.status).toBe(404);
  });
});


