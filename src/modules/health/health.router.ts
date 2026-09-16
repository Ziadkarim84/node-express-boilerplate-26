import { Router } from 'express';
import { z } from 'zod';
import { config } from '../../config/index.js';
import { registry } from '../../openapi/registry.js';
import { ok, okSchema } from '../../common/utils/response.js';
import { isShuttingDown } from '../../common/utils/graceful-shutdown.js';
import { checkDatabase, checkRedis, getCommitHash } from './health.service.js';

export const healthRouter = Router();

// Liveness: process is up. No dependency checks, so orchestrators don't
// restart the app when a dependency is down.
healthRouter.get('/', (_req, res) => {
  ok(res, {
    status: 'ok',
    name: config.appName,
    env: config.env,
    uptimeSeconds: Math.round(process.uptime()),
    commitHash: getCommitHash(),
  });
});

// Readiness: checks external dependencies (DB). 503 when unhealthy.
healthRouter.get('/ready', async (_req, res) => {
  if (isShuttingDown()) {
    ok(res, { status: 'shutting_down', checks: {} }, 503);
    return;
  }
  const [database, redis] = await Promise.all([checkDatabase(), checkRedis()]);
  const healthy = database.healthy && (redis?.healthy ?? true);

  ok(
    res,
    {
      status: healthy ? 'ok' : 'degraded',
      checks: { database, ...(redis ? { redis } : {}) },
    },
    healthy ? 200 : 503,
  );
});

registry.registerPath({
  method: 'get',
  path: '/v1/health',
  tags: ['Health'],
  summary: 'Liveness probe',
  responses: {
    200: {
      description: 'Process is up',
      content: {
        'application/json': {
          schema: okSchema(
            z.object({
              status: z.literal('ok'),
              name: z.string(),
              env: z.string(),
              uptimeSeconds: z.number(),
              commitHash: z.string(),
            }),
          ),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/v1/health/ready',
  tags: ['Health'],
  summary: 'Readiness probe (checks DB connectivity)',
  responses: {
    200: { description: 'All dependencies healthy' },
    503: { description: 'One or more dependencies unhealthy' },
  },
});
