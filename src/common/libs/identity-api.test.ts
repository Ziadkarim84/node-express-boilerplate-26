import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/index.js', () => ({
  config: {
    env: 'test',
    identity: {
      url: 'https://identity.test',
      timeoutMs: 50,
      cacheTtlSeconds: 60,
      negativeCacheTtlSeconds: 15,
    },
  },
}));
vi.mock('./cache.js', () => ({ cacheGet: vi.fn(), cacheSet: vi.fn() }));

const { cacheGet, cacheSet } = await import('./cache.js');
const { getCurrentUserCached, checkPermissionsCached, IdentityServiceError } =
  await import('./identity-api.js');

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('identity-api caching', () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    vi.mocked(cacheGet).mockResolvedValue(null);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('negative-caches an invalid token and serves it without calling identity', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, {}));

    expect(await getCurrentUserCached('bearer bad')).toBeNull();
    expect(cacheSet).toHaveBeenCalledWith(
      expect.stringContaining('identity:user:'),
      { invalid: true },
      15,
    );

    vi.mocked(cacheGet).mockResolvedValue({ invalid: true });
    fetchMock.mockClear();
    expect(await getCurrentUserCached('bearer bad')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('caches permission checks per token and permission set', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        data: { 'banks:read': true, 'banks:approve': false },
      }),
    );

    expect(
      await checkPermissionsCached('bearer ok', [
        'banks:read',
        'banks:approve',
      ]),
    ).toEqual(['banks:read']);
    expect(cacheSet).toHaveBeenCalledWith(
      expect.stringContaining('identity:perms:'),
      ['banks:read'],
      60,
    );

    vi.mocked(cacheGet).mockResolvedValue(['banks:read']);
    fetchMock.mockClear();
    expect(
      await checkPermissionsCached('bearer ok', [
        'banks:approve',
        'banks:read',
      ]),
    ).toEqual(['banks:read']);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('wraps a timeout or network failure in IdentityServiceError', async () => {
    fetchMock.mockRejectedValue(
      new DOMException('The operation was aborted', 'TimeoutError'),
    );

    await expect(getCurrentUserCached('bearer ok')).rejects.toBeInstanceOf(
      IdentityServiceError,
    );
  });

  it('wraps a 5xx in IdentityServiceError', async () => {
    fetchMock.mockResolvedValue(jsonResponse(503, {}));

    await expect(
      checkPermissionsCached('bearer ok', ['banks:read']),
    ).rejects.toBeInstanceOf(IdentityServiceError);
  });
});
