import type { Response } from 'express';
import { z } from 'zod';
import '../../openapi/registry.js'; // extends zod with .openapi()

/**
 * Every response uses one envelope:
 *   success → { isError: false, body: <payload> }
 *   failure → { isError: true,  body: { code, message, details? } }
 * Routers call ok(res, payload); the error middleware renders failures.
 */
export function ok<T>(res: Response, body: T, status = 200): void {
  res.status(status).json({ isError: false, body });
}

/** OpenAPI helper: the success envelope around a payload schema. */
export function okSchema<T extends z.ZodType>(body: T) {
  return z.object({ isError: z.literal(false), body });
}

export const errorEnvelopeSchema = z
  .object({
    isError: z.literal(true),
    body: z.object({
      code: z.string(),
      message: z.string(),
      details: z
        .array(z.object({ path: z.string().optional(), message: z.string() }))
        .optional(),
    }),
  })
  .openapi('ErrorEnvelope');
