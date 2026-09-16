import { describe, expect, it } from 'vitest';
import { guardedEnvSchema } from './index.js';

const deployedOk = {
  COOKIE_SECRET: 'a-real-secret',
  GCS_BUCKET: 'bucket',
  CORS_ORIGINS: 'https://app.example',
  IDENTITY_SERVICE_URL: 'https://identity.example',
};

const issuePaths = (env: Record<string, string>) => {
  const r = guardedEnvSchema.safeParse(env);
  return r.success ? [] : r.error.issues.map((i) => i.path.join('.'));
};

describe('config guards', () => {
  it('apply to staging exactly as to production', () => {
    for (const NODE_ENV of ['staging', 'production']) {
      expect(
        issuePaths({ NODE_ENV, ...deployedOk, JIMMY_AUTH: 'true' }),
      ).toEqual(['JIMMY_AUTH']);
      expect(
        issuePaths({
          NODE_ENV,
          ...deployedOk,
          COOKIE_SECRET: 'dev-cookie-secret-change-me',
        }),
      ).toEqual(['COOKIE_SECRET']);
      expect(issuePaths({ NODE_ENV, ...deployedOk, CORS_ORIGINS: '' })).toEqual(
        ['CORS_ORIGINS'],
      );
      expect(issuePaths({ NODE_ENV, ...deployedOk, GCS_BUCKET: '' })).toEqual([
        'GCS_BUCKET',
      ]);
      expect(issuePaths({ NODE_ENV, ...deployedOk })).toEqual([]);
    }
  });

  it('leave development and test unguarded', () => {
    for (const NODE_ENV of ['development', 'test']) {
      expect(issuePaths({ NODE_ENV, JIMMY_AUTH: 'true' })).toEqual([]);
    }
  });
});
