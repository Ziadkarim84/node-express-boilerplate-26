import { randomUUID } from 'node:crypto';
import { pinoHttp } from 'pino-http';
import { logger } from '../logger/index.js';

// Request logging with x-request-id correlation: honors an incoming header,
// otherwise generates a UUID; exposes req.log bound to the request id.
export const requestLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const headerId = req.headers['x-request-id'];
    const id =
      typeof headerId === 'string' && headerId ? headerId : randomUUID();
    res.setHeader('x-request-id', id);
    return id;
  },
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  autoLogging: {
    // Keep k8s/ALB health probes out of the logs
    ignore: (req) => req.url?.startsWith('/v1/health') ?? false,
  },
});
