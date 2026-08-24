import fs from 'node:fs';
import path from 'node:path';
import { config } from '../../config/index.js';
import { sequelize } from '../../db/index.js';

export type CheckResult = {
  healthy: boolean;
  message?: string;
};

let cachedCommitHash: string | undefined;

/** Prefer GIT_COMMIT env (set by CI/Docker), fall back to dist/commit.txt. */
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

export async function checkDatabase(): Promise<CheckResult> {
  try {
    await sequelize.query('SELECT 1');
    return { healthy: true };
  } catch (error) {
    return {
      healthy: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
