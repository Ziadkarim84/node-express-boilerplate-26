import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { config } from '../../config/index.js';
import { AppError } from '../errors/app-error.js';
import { logger } from '../logger/index.js';

function isBodyParseError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'type' in err &&
    (err as { type: string }).type === 'entity.parse.failed'
  );
}

/** Converts unmatched routes into a standard 404 error response. */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(AppError.notFound(`Cannot ${req.method} ${req.path}`));
};

/**
 * Global error handler — the ONLY place errors are turned into responses.
 * Express 5 automatically forwards rejected promises from async handlers
 * here, so services and handlers can simply `throw`.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  let appError: AppError;

  if (err instanceof AppError) {
    appError = err;
  } else if (err instanceof ZodError) {
    appError = AppError.fromValidation('request', err);
  } else if (isBodyParseError(err)) {
    appError = AppError.badRequest('Malformed request body');
  } else {
    const message =
      config.env === 'production'
        ? 'Internal server error'
        : err instanceof Error
          ? err.message
          : String(err);
    appError = AppError.internal(message);
  }

  // Unexpected errors are bugs — log with full stack. Operational 4xx are not.
  if (appError.statusCode >= 500) {
    (req.log ?? logger).error({ err }, appError.message);
  }

  res.status(appError.statusCode).json({ error: appError.toJSON() });
};
