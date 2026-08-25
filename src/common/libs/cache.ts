import { logger } from '../logger/index.js';
import { redis } from './redis.js';

// TTL cache: Redis when REDIS_URL is configured, in-memory otherwise.
// Redis errors degrade to a cache miss — callers never fail because of it.

const memory = new Map<string, { value: unknown; expiresAt: number }>();
const MAX_MEMORY_ENTRIES = 10_000;

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (redis) {
    try {
      const raw = await redis.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch (err) {
      logger.warn({ err }, `cacheGet failed for ${key}`);
      return null;
    }
  }

  const entry = memory.get(key);
  if (!entry || entry.expiresAt <= Date.now()) {
    memory.delete(key);
    return null;
  }
  return entry.value as T;
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  if (redis) {
    try {
      await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
      logger.warn({ err }, `cacheSet failed for ${key}`);
    }
    return;
  }

  if (memory.size >= MAX_MEMORY_ENTRIES) {
    const oldest = memory.keys().next().value;
    if (oldest) memory.delete(oldest);
  }
  memory.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export async function cacheDelete(key: string): Promise<void> {
  if (redis) {
    try {
      await redis.del(key);
    } catch (err) {
      logger.warn({ err }, `cacheDelete failed for ${key}`);
    }
    return;
  }
  memory.delete(key);
}
