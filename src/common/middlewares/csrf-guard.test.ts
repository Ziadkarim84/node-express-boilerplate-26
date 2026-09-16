import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./cors.js', () => ({
  isAllowedOrigin: (o: string) => o === 'https://app.example',
}));

const { csrfGuard } = await import('./csrf-guard.js');

function run(opts: {
  method: string;
  tokenType?: 'bearer' | 'jwt' | 'cookie';
  headers?: Record<string, string>;
}) {
  const headers = opts.headers ?? {};
  const req = {
    method: opts.method,
    tokenType: opts.tokenType,
    get: (name: string) => headers[name.toLowerCase()],
  } as unknown as Request;
  const next = vi.fn();
  csrfGuard(req, {} as Response, next);
  const err = next.mock.calls[0]?.[0] as { statusCode?: number } | undefined;
  return err?.statusCode ?? 'pass';
}

describe('csrfGuard', () => {
  it('ignores safe methods and header-authenticated callers', () => {
    expect(
      run({
        method: 'GET',
        tokenType: 'cookie',
        headers: { origin: 'https://evil.example' },
      }),
    ).toBe('pass');
    expect(
      run({
        method: 'POST',
        tokenType: 'bearer',
        headers: { origin: 'https://evil.example' },
      }),
    ).toBe('pass');
    expect(run({ method: 'POST', tokenType: 'jwt' })).toBe('pass');
    expect(run({ method: 'POST' })).toBe('pass');
  });

  it('rejects a cookie-authenticated mutation from a foreign origin', () => {
    expect(
      run({
        method: 'POST',
        tokenType: 'cookie',
        headers: { origin: 'https://evil.example' },
      }),
    ).toBe(403);
    expect(
      run({
        method: 'DELETE',
        tokenType: 'cookie',
        headers: {
          origin: 'https://evil.example',
          'sec-fetch-site': 'cross-site',
        },
      }),
    ).toBe(403);
  });

  it('rejects a cookie-authenticated mutation with no origin information', () => {
    expect(run({ method: 'POST', tokenType: 'cookie' })).toBe(403);
  });

  it('allows cookie-authenticated mutations from an allowed or same origin', () => {
    expect(
      run({
        method: 'POST',
        tokenType: 'cookie',
        headers: { origin: 'https://app.example' },
      }),
    ).toBe('pass');
    expect(
      run({
        method: 'PATCH',
        tokenType: 'cookie',
        headers: { 'sec-fetch-site': 'same-origin' },
      }),
    ).toBe('pass');
    expect(
      run({
        method: 'POST',
        tokenType: 'cookie',
        headers: { 'sec-fetch-site': 'none' },
      }),
    ).toBe('pass');
  });
});
