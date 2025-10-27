describe('isAdmin header-only authentication', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV, ADMIN_KEY: 'admin-secret', COOKIE_SECRET: 'test-cookie' };
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  test('accepts matching key in Authorization header', () => {
    const { isAdmin } = require('../api/_crypto');
    const req = { headers: { authorization: 'Key admin-secret' } };
    expect(isAdmin(req)).toBe(true);
  });

  test('rejects matching key in query string', () => {
    const { isAdmin } = require('../api/_crypto');
    const req = { query: { key: 'admin-secret' } };
    expect(isAdmin(req)).toBe(false);
  });
});
