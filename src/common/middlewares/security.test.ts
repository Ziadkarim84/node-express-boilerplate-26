import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppError } from '../errors/app-error.js';
import { roleIdByKey, type SessionUser } from '../libs/auth.js';

vi.mock('../libs/identity-api.js', () => ({
  getCurrentUserCached: vi.fn(),
}));
vi.mock('../libs/session.js', () => ({
  getForwardableAuthHeader: vi.fn(),
  clearAuthCookie: vi.fn(),
}));

const identityApi = vi.mocked(await import('../libs/identity-api.js'));
const sessionLib = vi.mocked(await import('../libs/session.js'));
const { isAuthenticated, onlySuperAdmin } = await import('./security.js');

const sysadmin: SessionUser = {
  id: 1,
  email: 'admin@example.com',
  roleIds: [roleIdByKey.SYSADMIN],
  scopeIds: null,
};
const regularUser: SessionUser = {
  ...sysadmin,
  id: 2,
  roleIds: [roleIdByKey.FIELD_AGENT],
};

async function run(
  middleware: typeof isAuthenticated,
  req: Partial<Request> = {},
) {
  const next = vi.fn();
  await middleware(req as Request, {} as Response, next);
  return {
    req: req as Request,
    error: next.mock.calls[0]?.[0] as AppError | undefined,
  };
}

describe('isAuthenticated', () => {
  beforeEach(() => vi.clearAllMocks());

  it('passes through when the session middleware already set req.user', async () => {
    const { error } = await run(isAuthenticated, { user: regularUser });
    expect(error).toBeUndefined();
    expect(identityApi.getCurrentUserCached).not.toHaveBeenCalled();
  });

  it('401 and clears the cookie when no credentials are present', async () => {
    sessionLib.getForwardableAuthHeader.mockReturnValue(null);
    const { error } = await run(isAuthenticated);
    expect(error?.statusCode).toBe(401);
    expect(sessionLib.clearAuthCookie).toHaveBeenCalled();
  });

  it('401 when the identity service rejects the token', async () => {
    sessionLib.getForwardableAuthHeader.mockReturnValue('bearer bad-token');
    identityApi.getCurrentUserCached.mockResolvedValue(null);
    const { error } = await run(isAuthenticated);
    expect(error?.statusCode).toBe(401);
    expect(sessionLib.clearAuthCookie).toHaveBeenCalled();
  });

  it('resolves the caller via the identity service and attaches req.user', async () => {
    sessionLib.getForwardableAuthHeader.mockReturnValue('bearer good-token');
    identityApi.getCurrentUserCached.mockResolvedValue(regularUser);
    const { req, error } = await run(isAuthenticated);
    expect(error).toBeUndefined();
    expect(req.user).toEqual(regularUser);
    expect(identityApi.getCurrentUserCached).toHaveBeenCalledWith(
      'bearer good-token',
    );
  });
});

describe('onlySuperAdmin', () => {
  beforeEach(() => vi.clearAllMocks());

  it('401 when unauthenticated', async () => {
    sessionLib.getForwardableAuthHeader.mockReturnValue(null);
    const { error } = await run(onlySuperAdmin);
    expect(error?.statusCode).toBe(401);
  });

  it('403 for a non-SYSADMIN user', async () => {
    const { error } = await run(onlySuperAdmin, { user: regularUser });
    expect(error?.statusCode).toBe(403);
  });

  it('passes a SYSADMIN', async () => {
    const { error } = await run(onlySuperAdmin, { user: sysadmin });
    expect(error).toBeUndefined();
  });
});
