import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

// Simulate the identity service: one known bearer token resolves to a user
// with users:* permissions; everything else is rejected.
vi.mock('./common/libs/identity-api.js', () => ({
  getCurrentUserCached: vi.fn((authHeader: string) =>
    Promise.resolve(
      authHeader === 'bearer valid-token'
        ? { id: 7, email: 'agent@shopup.org', roleIds: [7], scopeIds: null }
        : null,
    ),
  ),
  checkPermissionsCached: vi.fn(
    (_authHeader: string, permissionIds: string[]) =>
      Promise.resolve(permissionIds.filter((p) => p.startsWith('examples:'))),
  ),
}));

// No DB in these tests: the local users mapping is stubbed.
vi.mock('./common/libs/users-mirror.js', () => ({
  resolveLocalUserId: vi.fn((user: { id: number }) =>
    Promise.resolve(user.id + 100),
  ),
}));

// An explicit allow-list so the CSRF guard has something to compare against
// (with none set, development/test allow every origin).
process.env.CORS_ORIGINS = 'https://app.example';

const { createApp } = await import('./app.js');

// Integration tests against the assembled app (no port, no DB needed).
const app = createApp();

describe('app', () => {
  it('GET /v1/health returns liveness info', async () => {
    const res = await request(app).get('/v1/health');

    expect(res.status).toBe(200);
    expect(res.body.body.status).toBe('ok');
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('serves the generated OpenAPI spec', async () => {
    const res = await request(app).get('/openapi.json');

    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.1.0');
    expect(res.body.paths['/v1/examples']).toBeDefined();
  });

  it('returns a standard 404 envelope for unknown routes', async () => {
    const res = await request(app).get('/nope');

    expect(res.status).toBe(404);
    expect(res.body.isError).toBe(true);
    expect(res.body.body.code).toBe('NOT_FOUND');
  });

  it('returns 401 for protected routes without credentials', async () => {
    for (const call of [
      request(app).get('/v1/examples'),
      request(app).post('/v1/examples').send({}),
      request(app).get('/v1/auth/me'),
    ]) {
      const res = await call;
      expect(res.status).toBe(401);
      expect(res.body.body.code).toBe('UNAUTHORIZED');
    }
  });

  it('resolves a bearer token through the identity service', async () => {
    const res = await request(app)
      .get('/v1/auth/me')
      .set('Authorization', 'bearer valid-token');

    expect(res.status).toBe(200);
    expect(res.body.body.id).toBe(7);
    expect(res.body.body.roleIds).toEqual([7]);
  });

  it('rejects invalid bodies with a validation error before hitting the DB', async () => {
    const res = await request(app)
      .post('/v1/examples')
      .set('Authorization', 'bearer valid-token')
      .send({ name: '', price: -2 });

    expect(res.status).toBe(400);
    expect(res.body.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.body.details.length).toBeGreaterThan(0);
  });

  it('rejects malformed JSON with 400', async () => {
    const res = await request(app)
      .post('/v1/examples')
      .set('Authorization', 'bearer valid-token')
      .set('content-type', 'application/json')
      .send('{"broken":');

    expect(res.status).toBe(400);
    expect(res.body.body.code).toBe('BAD_REQUEST');
  });

  it('rejects a cookie-authenticated mutation from a foreign origin (CSRF)', async () => {
    // cookie-parser's signed format: s:<value>.<base64 hmac-sha256 without '='>
    const { createHmac } = await import('node:crypto');
    const mac = createHmac('sha256', 'dev-cookie-secret-change-me')
      .update('valid-token')
      .digest('base64')
      .replace(/=+$/, '');
    const signed = `s:valid-token.${mac}`;

    const foreign = await request(app)
      .post('/v1/examples')
      .set('Cookie', `token=${signed}`)
      .set('Origin', 'https://evil.example')
      .send({ name: 'x', code: 'X', price: 1 });
    expect(foreign.status).toBe(403);

    // Same request from an allowed origin gets past the guard (fails later
    // on the missing examples:create permission → 403 from authorize, so
    // assert on the message instead of the status).
    const own = await request(app)
      .post('/v1/examples')
      .set('Cookie', `token=${signed}`)
      .set('Sec-Fetch-Site', 'same-origin')
      .send({ name: '', price: -1 });
    expect(own.status).toBe(400);
    expect(own.body.body.code).toBe('VALIDATION_ERROR');
  });
});
