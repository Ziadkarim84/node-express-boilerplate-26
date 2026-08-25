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
  checkPermissions: vi.fn((_authHeader: string, permissionIds: string[]) =>
    Promise.resolve(permissionIds.filter((p) => p.startsWith('examples:'))),
  ),
}));

const { createApp } = await import('./app.js');

// Integration tests against the assembled app (no port, no DB needed).
const app = createApp();

describe('app', () => {
  it('GET /v1/health returns liveness info', async () => {
    const res = await request(app).get('/v1/health');

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
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
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 401 for protected routes without credentials', async () => {
    for (const call of [
      request(app).get('/v1/examples'),
      request(app).post('/v1/examples').send({}),
      request(app).get('/v1/auth/me'),
    ]) {
      const res = await call;
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    }
  });

  it('resolves a bearer token through the identity service', async () => {
    const res = await request(app)
      .get('/v1/auth/me')
      .set('Authorization', 'bearer valid-token');

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(7);
    expect(res.body.data.roleIds).toEqual([7]);
  });

  it('rejects invalid bodies with a validation error before hitting the DB', async () => {
    const res = await request(app)
      .post('/v1/examples')
      .set('Authorization', 'bearer valid-token')
      .send({ name: '', price: -2 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });

  it('rejects malformed JSON with 400', async () => {
    const res = await request(app)
      .post('/v1/examples')
      .set('Authorization', 'bearer valid-token')
      .set('content-type', 'application/json')
      .send('{"broken":');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });
});
