import { describe, expect, it, vi } from 'vitest';

vi.mock('../../db/index.js', () => ({
  sequelize: { query: vi.fn(() => new Promise(() => undefined)) }, // never resolves
}));
vi.mock('../../common/libs/redis.js', () => ({ redis: null }));
vi.mock('../../config/index.js', () => ({
  config: { env: 'test', gitCommit: 'abc', health: { checkTimeoutMs: 20 } },
}));

const { checkDatabase, checkRedis } = await import('./health.service.js');

describe('health checks', () => {
  it('reports the database unhealthy when the query hangs past the timeout', async () => {
    const result = await checkDatabase();
    expect(result.healthy).toBe(false);
    expect(result.message).toContain('timed out');
  });

  it('skips redis when it is not configured', async () => {
    expect(await checkRedis()).toBeNull();
  });
});
