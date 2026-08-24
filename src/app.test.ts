import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';

/**
 * Integration tests against the assembled app (no port, no DB needed:
 * liveness, docs, validation and 404 paths never touch the database).
 */
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
    expect(res.body.paths['/v1/users']).toBeDefined();
  });

  it('returns a standard 404 envelope for unknown routes', async () => {
    const res = await request(app).get('/nope');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('rejects invalid bodies with a validation error before hitting the DB', async () => {
    const res = await request(app)
      .post('/v1/users')
      .send({ firstName: '', email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });

  it('rejects malformed JSON with 400', async () => {
    const res = await request(app)
      .post('/v1/users')
      .set('content-type', 'application/json')
      .send('{"broken":');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });
});
