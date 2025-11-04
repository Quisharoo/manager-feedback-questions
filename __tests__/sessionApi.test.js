describe('SessionApi', () => {
  let SessionApi;

  beforeEach(() => {
    jest.resetModules();
    global.fetch = jest.fn();
    delete global.SessionApi;
    SessionApi = require('../public/sessionApi');
  });

  afterEach(() => {
    jest.resetModules();
    delete global.SessionApi;
    delete global.fetch;
  });

  test('createCapabilitySession posts session name and returns links', async () => {
    const responsePayload = { id: '123', links: { edit: '/edit', view: '/view' } };
    global.fetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: jest.fn().mockResolvedValue(responsePayload)
    });

    const result = await SessionApi.createCapabilitySession('My Session');

    expect(global.fetch).toHaveBeenCalledWith('/api/capsessions', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }));
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body).toEqual({ name: 'My Session' });
    expect(result).toEqual(responsePayload);
  });

  test('createCapabilitySession surfaces server errors', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: jest.fn().mockResolvedValue({ error: 'Invalid name' })
    });

    await expect(SessionApi.createCapabilitySession('Bad')).rejects.toThrow('Invalid name');
  });

  test('fetchAdminSessions validates admin key via Authorization header', async () => {
    const responsePayload = { sessions: [{ id: '1', name: 'Demo' }] };
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(responsePayload)
    });

    const result = await SessionApi.fetchAdminSessions('secret');

    expect(global.fetch).toHaveBeenCalledWith('/api/admin/sessions', {
      headers: { Authorization: 'Key secret' }
    });
    expect(result).toEqual(responsePayload);
  });

  test('fetchAdminSessions rejects invalid keys', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 403,
      json: jest.fn().mockResolvedValue({ error: 'Forbidden' })
    });

    await expect(SessionApi.fetchAdminSessions('wrong')).rejects.toThrow('Forbidden');
  });

  test('deleteAdminSession requires id and auth key', async () => {
    await expect(SessionApi.deleteAdminSession('', 'secret')).rejects.toThrow('Session id is required');
    await expect(SessionApi.deleteAdminSession('123', '')).rejects.toThrow('Admin key is required');

    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ success: true })
    });

    const result = await SessionApi.deleteAdminSession('123', 'secret');
    expect(global.fetch).toHaveBeenCalledWith('/api/admin/sessions/123', {
      method: 'DELETE',
      headers: { Authorization: 'Key secret' }
    });
    expect(result).toEqual({ success: true });
  });
});
