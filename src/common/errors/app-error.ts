import type { ZodError } from 'zod';

export type ErrorDetail = {
  path?: string;
  message: string;
};

export type ErrorBody = {
  code: string; // machine-readable, e.g. VALIDATION_ERROR
  message: string;
  details?: ErrorDetail[]; // per-field breakdown for validation errors
};

/**
 * The single error type the API responds with. Throw it (or a factory like
 * AppError.notFound()) anywhere; the error middleware renders
 * { error: { code, message, details? } }.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: ErrorDetail[];
  readonly isOperational = true;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: ErrorDetail[],
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, details?: ErrorDetail[]): AppError {
    return new AppError(400, 'BAD_REQUEST', message, details);
  }

  static unauthorized(message = 'Unauthenticated'): AppError {
    return new AppError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'Forbidden'): AppError {
    return new AppError(403, 'FORBIDDEN', message);
  }

  static notFound(message = 'Resource not found'): AppError {
    return new AppError(404, 'NOT_FOUND', message);
  }

  static conflict(message: string): AppError {
    return new AppError(409, 'CONFLICT', message);
  }

  static internal(message = 'Internal server error'): AppError {
    return new AppError(500, 'INTERNAL_SERVER_ERROR', message);
  }

  static fromValidation(location: string, error: ZodError): AppError {
    const details: ErrorDetail[] = error.issues.map((issue) => ({
      path: [location, ...issue.path.map(String)].join('.'),
      message: issue.message,
    }));
    return new AppError(
      400,
      'VALIDATION_ERROR',
      'Request validation failed',
      details,
    );
  }

  toJSON(): ErrorBody {
    return {
      code: this.code,
      message: this.message,
      ...(this.details ? { details: this.details } : {}),
    };
  }
}
