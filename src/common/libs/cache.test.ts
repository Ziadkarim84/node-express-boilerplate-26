import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./redis.js', () => ({ redis: null })); // exercise the in-memory path

const { cacheGet, cacheSet, cacheDelete } = await import('./cache.js');

describe('cache (in-memory fallback)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('stores and retrieves a value', async () => {
    await cacheSet('k1', { a: 1 }, 60);
    await expect(cacheGet('k1')).resolves.toEqual({ a: 1 });
  });

  it('misses for unknown keys', async () => {
    await expect(cacheGet('nope')).resolves.toBeNull();
  });

  it('expires values after the TTL', async () => {
    vi.useFakeTimers();
    await cacheSet('k2', 'v', 10);
    vi.advanceTimersByTime(11_000);
    await expect(cacheGet('k2')).resolves.toBeNull();
  });

  it('deletes values', async () => {
    await cacheSet('k3', 'v', 60);
    await cacheDelete('k3');
    await expect(cacheGet('k3')).resolves.toBeNull();
  });
});
