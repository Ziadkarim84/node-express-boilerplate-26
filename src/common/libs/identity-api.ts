import { createHash } from 'node:crypto';
import { config } from '../../config/index.js';
import { logger } from '../logger/index.js';
import type { SessionUser } from './auth.js';
import { cacheGet, cacheSet } from './cache.js';

// Client for the central identity service (shopup-lite's authApi):
//   GET  /v0/user                    → resolve the caller from their token
//   POST /v0/user/permissions/check  → { [permissionId]: boolean }
// Extend with more /v0 endpoints as needed.
const baseUrl = config.identity.url?.replace(/\/+$/, '');

export class IdentityServiceError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'IdentityServiceError';
  }
}

async function identityRequest<T>(
  method: 'GET' | 'POST',
  path: string,
  authHeader: string,
  body?: unknown,
): Promise<T | null> {
  if (!baseUrl) {
    logger.warn(
      'Identity service call skipped: IDENTITY_SERVICE_URL is not configured',
    );
    return null;
  }

  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        authorization: authHeader,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(config.identity.timeoutMs),
    });
  } catch (err) {
    // Timeout / DNS / connection refused: a dependency failure, not a bug.
    throw new IdentityServiceError(
      0,
      `Identity service ${method} ${path} unreachable: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // 401/403 = invalid/insufficient token — not an error here.
  if (res.status === 401 || res.status === 403) {
    return null;
  }

  if (!res.ok) {
    throw new IdentityServiceError(
      res.status,
      `Identity service ${method} ${path} failed with ${res.status}`,
    );
  }

  return (await res.json()) as T;
}

// Resolves the caller from their auth header; null when the token is invalid.
export async function getCurrentUser(
  authHeader: string,
): Promise<SessionUser | null> {
  const response = await identityRequest<{ data: SessionUser }>(
    'GET',
    '/v0/user',
    authHeader,
  );
  return response?.data ?? null;
}

// Returns the subset of permissionIds the caller holds.
export async function checkPermissions(
  authHeader: string,
  permissionIds: string[],
): Promise<string[]> {
  const response = await identityRequest<{ data: Record<string, boolean> }>(
    'POST',
    '/v0/user/permissions/check',
    authHeader,
    { permissionIds },
  );

  if (!response) return [];
  return Object.keys(response.data).filter((id) => response.data[id]);
}

// Per-token caches (see cache.ts: Redis when configured, else in-memory) so
// hot endpoints don't hit the identity service on every request. Keys are
// sha256 of the auth header — raw tokens never appear in Redis.

function tokenHash(authHeader: string): string {
  return createHash('sha256').update(authHeader).digest('hex');
}

// Invalid tokens are cached too (short TTL) so a flood of garbage or expired
// tokens does not become a flood against the shared identity service.
const INVALID = { invalid: true } as const;
type CachedUser = SessionUser | typeof INVALID;

export async function getCurrentUserCached(
  authHeader: string,
): Promise<SessionUser | null> {
  const key = `identity:user:${tokenHash(authHeader)}`;

  const cached = await cacheGet<CachedUser>(key);
  if (cached) return 'invalid' in cached ? null : cached;

  const user = await getCurrentUser(authHeader);
  if (user) {
    await cacheSet(key, user, config.identity.cacheTtlSeconds);
  } else if (baseUrl) {
    await cacheSet(key, INVALID, config.identity.negativeCacheTtlSeconds);
  }

  return user;
}

// Permission results cached per (token, permission set) for the same TTL as
// the principal, so a protected route costs one identity call per TTL.
export async function checkPermissionsCached(
  authHeader: string,
  permissionIds: string[],
): Promise<string[]> {
  const set = [...permissionIds].sort().join(',');
  const key = `identity:perms:${tokenHash(authHeader)}:${tokenHash(set)}`;

  const cached = await cacheGet<string[]>(key);
  if (cached) return cached;

  const granted = await checkPermissions(authHeader, permissionIds);
  await cacheSet(key, granted, config.identity.cacheTtlSeconds);
  return granted;
}
