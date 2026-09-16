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
 * Stable codes for business-rule failures (HTTP 422). Add here, never inline
 * a string, so the front-end and the API docs share one list.
 */
export const DOMAIN_ERROR_CODES = [
  'INVALID_TRANSITION', // status change not allowed from the current status
  'LOCKED', // record locked (description locked, pricing confirmed, LC issued)
  'GATE_BLOCKED', // a document gate is not satisfied (PIs not final, inspection unsigned)
  'CHECK_FAILED', // Check 1 / Check 2 not satisfied
  'PRECONDITION_FAILED', // some other required state is missing (no verified advance, KYC not verified)
  'SEPARATION_OF_DUTIES', // same user on both sides of a two-person action
  'IN_USE', // cannot delete / deactivate: referenced by another record
  'BALANCE_NOT_ZERO', // ledger receivable must be zero (close trade)
  'UNBALANCED_ENTRY', // journal entry debits ≠ credits
] as const;

export type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[number];

/**
 * The single error type the API responds with. Throw it (or a factory like
 * AppError.notFound()) anywhere; the error middleware renders
 * { isError: true, body: { code, message, details? } }.
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

  static conflict(message: string, details?: ErrorDetail[]): AppError {
    return new AppError(409, 'CONFLICT', message, details);
  }

  static internal(message = 'Internal server error'): AppError {
    return new AppError(500, 'INTERNAL_SERVER_ERROR', message);
  }

  /** A dependency (identity service, ...) failed or timed out. */
  static upstreamUnavailable(message: string): AppError {
    return new AppError(503, 'UPSTREAM_UNAVAILABLE', message);
  }

  static payloadTooLarge(message: string): AppError {
    return new AppError(413, 'PAYLOAD_TOO_LARGE', message);
  }

  static unsupportedMediaType(message: string): AppError {
    return new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', message);
  }

  /**
   * Domain rule violations: the request is well-formed and the caller is
   * allowed, but the business state forbids the action. 422 with a stable
   * code the front-end can branch on (see DomainErrorCode).
   */
  static domain(
    code: DomainErrorCode,
    message: string,
    details?: ErrorDetail[],
  ): AppError {
    return new AppError(422, code, message, details);
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
