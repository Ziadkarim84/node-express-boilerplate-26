import { Router } from 'express';
import { z } from 'zod';
import { config } from '../../config/index.js';
import { registry } from '../../openapi/registry.js';
import { checkDatabase, getCommitHash } from './health.service.js';

export const healthRouter = Router();

/**
 * GET /v1/health — liveness: is the process up? No dependency checks,
 * so orchestrators never restart the app because a dependency is down.
 */
healthRouter.get('/', (_req, res) => {
  res.json({
    data: {
      status: 'ok',
      name: config.appName,
      env: config.env,
      uptimeSeconds: Math.round(process.uptime()),
      commitHash: getCommitHash(),
    },
  });
});

/**
 * GET /v1/health/ready — readiness: can this instance serve traffic?
 * Checks external dependencies (DB). Returns 503 when unhealthy.
 */
healthRouter.get('/ready', async (_req, res) => {
  const database = await checkDatabase();
  const healthy = database.healthy;

  res.status(healthy ? 200 : 503).json({
    data: {
      status: healthy ? 'ok' : 'degraded',
      checks: { database },
    },
  });
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
          schema: z.object({
            data: z.object({
              status: z.literal('ok'),
              name: z.string(),
              env: z.string(),
              uptimeSeconds: z.number(),
              commitHash: z.string(),
            }),
          }),
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
