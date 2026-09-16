import type { Request, Response } from 'express';
import { ForeignKeyConstraintError, UniqueConstraintError } from 'sequelize';
import { describe, expect, it, vi } from 'vitest';
import { IdentityServiceError } from '../libs/identity-api.js';
import { errorHandler } from './error-handler.js';

type Envelope = { isError: boolean; body: { code: string } };

function run(err: unknown) {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  const req = { log: { error: vi.fn() } } as unknown as Request;
  errorHandler(err, req, res as unknown as Response, vi.fn());
  return {
    status: res.status.mock.calls[0]?.[0] as number,
    body: res.json.mock.calls[0]?.[0] as Envelope,
  };
}

describe('errorHandler — Sequelize constraint errors', () => {
  it('maps UniqueConstraintError to 409 CONFLICT', () => {
    const err = new UniqueConstraintError({
      message: 'dup',
      errors: [{ path: 'swift_code', message: 'must be unique' } as never],
    });
    const { status, body } = run(err);
    expect(status).toBe(409);
    expect(body).toMatchObject({ isError: true, body: { code: 'CONFLICT' } });
  });

  it('maps ForeignKeyConstraintError to 409 CONFLICT', () => {
    const err = new ForeignKeyConstraintError({
      message: 'fk',
      fields: { country_id: '9999' },
      parent: new Error('fk'),
    } as never);
    const { status, body } = run(err);
    expect(status).toBe(409);
    expect(body.body.code).toBe('CONFLICT');
  });

  it('still maps unknown errors to 500', () => {
    const { status, body } = run(new Error('boom'));
    expect(status).toBe(500);
    expect(body.body.code).toBe('INTERNAL_SERVER_ERROR');
  });

  it('maps IdentityServiceError to 503 UPSTREAM_UNAVAILABLE', () => {
    const { status, body } = run(
      new IdentityServiceError(502, 'identity down'),
    );
    expect(status).toBe(503);
    expect(body.body.code).toBe('UPSTREAM_UNAVAILABLE');
  });
});
