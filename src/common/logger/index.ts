import { pino } from 'pino';
import { config } from '../../config/index.js';

/**
 * Structured JSON logging with pino.
 * In development, logs are pretty-printed via pino-pretty.
 * Never use console.log in application code — use this logger,
 * or `req.log` inside request handlers (it carries the request id).
 */
export const logger = pino({
  level: config.env === 'test' ? 'silent' : config.logLevel,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
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
