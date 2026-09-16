import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ForeignKeyConstraintError, UniqueConstraintError } from 'sequelize';
import { ZodError } from 'zod';
import { config } from '../../config/index.js';
import { AppError } from '../errors/app-error.js';
import { IdentityServiceError } from '../libs/identity-api.js';
import { logger } from '../logger/index.js';

function isBodyParseError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'type' in err &&
    (err as { type: string }).type === 'entity.parse.failed'
  );
}

/** Every error the app can raise, normalised to one AppError. */
function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;

  if (err instanceof ZodError) return AppError.fromValidation('request', err);

  if (isBodyParseError(err))
    return AppError.badRequest('Malformed request body');

  // Dependency down or slow: 503 with its own code so dashboards separate
  // it from our bugs, and clients know to retry.
  if (err instanceof IdentityServiceError) {
    return AppError.upstreamUnavailable('Identity service unavailable');
  }

  // A service check normally catches duplicates first; this is the race
  // (or a missed check) landing on the DB index. Never a 500.
  if (err instanceof UniqueConstraintError) {
    return AppError.conflict(
      'A record with the same unique value already exists',
      err.errors.map((e) => ({
        path: e.path ?? undefined,
        message: e.message,
      })),
    );
  }

  if (err instanceof ForeignKeyConstraintError) {
    return AppError.conflict(
      'The record references a row that does not exist, or is still referenced by other rows',
      err.fields
        ? Object.keys(err.fields).map((field) => ({
            path: field,
            message: err.index ?? 'foreign key',
          }))
        : undefined,
    );
  }

  const message =
    config.env === 'production'
      ? 'Internal server error'
      : err instanceof Error
        ? err.message
        : String(err);
  return AppError.internal(message);
}

// Turns unmatched routes into a standard 404 response.
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(AppError.notFound(`Cannot ${req.method} ${req.path}`));
};

// The only place errors become responses. Express 5 forwards rejected
// promises from async handlers here — services just throw.
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const appError = toAppError(err);

  // Unexpected errors are bugs — log with full stack. Operational 4xx are not.
  if (appError.statusCode >= 500) {
    (req.log ?? logger).error({ err }, appError.message);
  }

  res
    .status(appError.statusCode)
    .json({ isError: true, body: appError.toJSON() });
};
