import { Redis } from 'ioredis';
import { config } from '../../config/index.js';
import { logger } from '../logger/index.js';

// Shared Redis client. Optional: when REDIS_URL is unset, `redis` is null and
// consumers (see cache.ts) fall back to in-memory behavior.
export const redis: Redis | null = config.redis.url
  ? new Redis(config.redis.url, {
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
      // A Redis that accepts TCP but never answers must not stall every
      // authenticated request: fail the command fast and fall through.
      connectTimeout: config.redis.connectTimeoutMs,
      commandTimeout: config.redis.commandTimeoutMs,
    })
  : null;

if (redis) {
  redis.on('error', (err) => {
    logger.error({ err }, 'Redis connection error');
  });
  redis.once('ready', () => {
    logger.info('Redis connected');
  });
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    logger.info('Closing Redis connection...');
    await redis.quit().catch(() => redis.disconnect());
  }
}
