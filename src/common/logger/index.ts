import { pino } from 'pino';
import { config } from '../../config/index.js';

// Structured JSON logs via pino (pretty-printed in dev). Use req.log inside
// request handlers (carries the request id), logger elsewhere. No console.log.
export const logger = pino({
  level: config.env === 'test' ? 'silent' : config.logLevel,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-access-token"]',
      'res.headers["set-cookie"]',
      '*.password',
      '*.token',
    ],
    censor: '[REDACTED]',
  },
  ...(config.env === 'development'
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            translateTime: 'SYS:HH:MM:ss',
            ignore: 'pid,hostname',
            singleLine: true,
          },
        },
      }
    : {}),
});
