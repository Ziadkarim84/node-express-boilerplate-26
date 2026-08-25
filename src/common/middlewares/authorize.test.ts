import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppError } from '../errors/app-error.js';
import { roleIdByKey, type SessionUser } from '../libs/auth.js';

vi.mock('../libs/identity-api.js', () => ({
  checkPermissions: vi.fn(),
  getCurrentUserCached: vi.fn(),
}));
vi.mock('../libs/session.js', () => ({
  getForwardableAuthHeader: vi.fn(() => 'bearer some-token'),
}));

const identityApi = vi.mocked(await import('../libs/identity-api.js'));
const { authorize, authorizeRoles } = await import('./authorize.js');

const jwtUser: SessionUser = {
  id: 1,
  roleIds: [roleIdByKey.SOFTWARE_ENGINEER],
  scopeIds: null,
  permissions: ['users:read'],
};

const bearerUser: SessionUser = {
  id: 2,
  roleIds: [roleIdByKey.FIELD_AGENT],
  scopeIds: null,
  // no permissions claim → identity service is consulted
};

async function run(
  middleware: ReturnType<typeof authorize>,
  user?: SessionUser,
) {
  const next = vi.fn();
  await middleware({ user } as Request, {} as Response, next);
  return next.mock.calls[0]?.[0] as AppError | undefined;
}

describe('authorize', () => {
  beforeEach(() => vi.clearAllMocks());

  it('401 when unauthenticated', async () => {
    const err = await run(authorize());
    expect(err?.statusCode).toBe(401);
  });

  it('passes any authenticated user when no permissions required', async () => {
    expect(await run(authorize(), bearerUser)).toBeUndefined();
    expect(identityApi.checkPermissions).not.toHaveBeenCalled();
  });

  it('checks the JWT permissions claim locally — no identity call', async () => {
    expect(
      await run(authorize({ only: 'users:read' }), jwtUser),
    ).toBeUndefined();
    expect(identityApi.checkPermissions).not.toHaveBeenCalled();
  });

  it('403 when the JWT claim lacks the permission', async () => {
    const err = await run(authorize({ only: 'users:create' }), jwtUser);
    expect(err?.statusCode).toBe(403);
  });

  it('consults the identity service for bearer users', async () => {
    identityApi.checkPermissions.mockResolvedValue(['users:read']);
    const err = await run(
      authorize({ oneOf: ['users:read', 'users:export'] }),
      bearerUser,
    );
    expect(err).toBeUndefined();
    expect(identityApi.checkPermissions).toHaveBeenCalledWith(
      'bearer some-token',
      ['users:read', 'users:export'],
    );
  });

  it('403 when the identity service grants none of the permissions', async () => {
    identityApi.checkPermissions.mockResolvedValue([]);
    const err = await run(authorize({ only: 'users:create' }), bearerUser);
    expect(err?.statusCode).toBe(403);
  });
});

describe('authorizeRoles', () => {
  beforeEach(() => vi.clearAllMocks());

  it('401 when unauthenticated', async () => {
    expect((await run(authorizeRoles(['SYSADMIN'])))?.statusCode).toBe(401);
  });

  it('403 when the role is not allowed', async () => {
    const err = await run(authorizeRoles(['SYSADMIN']), bearerUser);
    expect(err?.statusCode).toBe(403);
  });

  it('passes an allowed role from the principal', async () => {
    expect(
      await run(authorizeRoles(['FIELD_AGENT', 'CALL_AGENT']), bearerUser),
    ).toBeUndefined();
  });

  it('falls back to the identity service when roleIds are missing', async () => {
    identityApi.getCurrentUserCached.mockResolvedValue({
      ...bearerUser,
      roleIds: [roleIdByKey.SYSADMIN],
    });
    const noRoles: SessionUser = { ...bearerUser, roleIds: [] };
    expect(await run(authorizeRoles(['SYSADMIN']), noRoles)).toBeUndefined();
    expect(identityApi.getCurrentUserCached).toHaveBeenCalled();
  });
});
