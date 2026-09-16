import fs from 'node:fs';
import path from 'node:path';
import { config } from '../../config/index.js';
import { sequelize } from '../../db/index.js';
import { redis } from '../../common/libs/redis.js';

export type CheckResult = {
  healthy: boolean;
  message?: string;
};

/** Bounds a dependency check so a wedged pool or socket answers 503, not a hang. */
async function withTimeout<T>(
  label: string,
  work: Promise<T>,
  ms = config.health.checkTimeoutMs,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(new Error(`${label} check timed out after ${String(ms)} ms`)),
      ms,
    );
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

let cachedCommitHash: string | undefined;

// Prefer GIT_COMMIT (set by CI/Docker), fall back to dist/commit.txt.
export function getCommitHash(): string {
  if (cachedCommitHash) return cachedCommitHash;

  if (config.gitCommit) {
    cachedCommitHash = config.gitCommit;
    return cachedCommitHash;
  }

  const commitFile = path.resolve('dist', 'commit.txt');
  const fromFile = fs.existsSync(commitFile)
    ? fs.readFileSync(commitFile, 'utf8').trim()
    : '';
  cachedCommitHash = fromFile || 'N/A';
  return cachedCommitHash;
}

// Null when Redis isn't configured (it's optional — probes skip it then).
export async function checkRedis(): Promise<CheckResult | null> {
  if (!redis) return null;
  try {
    await withTimeout('redis', redis.ping());
    return { healthy: true };
  } catch (error) {
    return {
      healthy: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function checkDatabase(): Promise<CheckResult> {
  try {
    await withTimeout('database', sequelize.query('SELECT 1'));
    return { healthy: true };
  } catch (error) {
    return {
      healthy: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
