import type { Request, RequestHandler } from 'express';
import type { ZodType, z } from 'zod';
import { AppError } from '../errors/app-error.js';

export type RequestSchemas = {
  params?: ZodType;
  query?: ZodType;
  body?: ZodType;
};

export type Validated<S extends RequestSchemas> = {
  [K in keyof S & ('params' | 'query' | 'body')]: S[K] extends ZodType
    ? z.infer<S[K]>
    : never;
};

declare module 'express-serve-static-core' {
  interface Request {
    validated?: Record<string, unknown>;
  }
}

/**
 * Validates request parts against Zod schemas.
 * The parsed (and transformed/coerced) values are stored on `req.validated`
 * — Express 5 makes req.query a read-only getter, so we don't mutate it.
 * Read them back in the handler with `getValidated<typeof schemas>(req)`.
 */
export function validate(schemas: RequestSchemas): RequestHandler {
  return (req, _res, next) => {
    const validated: Record<string, unknown> = {};

    for (const location of ['params', 'query', 'body'] as const) {
      const schema = schemas[location];
      if (!schema) continue;

      const result = schema.safeParse(req[location]);
      if (!result.success) {
        next(AppError.fromValidation(location, result.error));
        return;
      }
      validated[location] = result.data;
    }

    req.validated = validated;
    next();
  };
}

export function getValidated<S extends RequestSchemas>(
  req: Request,
): Validated<S> {
  return (req.validated ?? {}) as Validated<S>;
}
