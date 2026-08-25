import { z } from 'zod';
import { registry } from '../../openapi/registry.js';

// One Zod schema per request/response shape: drives runtime validation,
// static types (z.infer), and the OpenAPI docs (registerPath below).

export const exampleSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    code: z.string(),
    price: z.number(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi('Example');

export const createExampleBody = z
  .object({
    name: z.string().min(1).max(255),
    code: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[A-Za-z0-9_-]+$/, 'Code may contain letters, digits, - and _'),
    price: z.number().nonnegative(),
  })
  .openapi('CreateExampleInput');

export type CreateExampleInput = z.infer<typeof createExampleBody>;

export const exampleIdParams = z.object({
  exampleId: z.coerce.number().int().positive(),
});

export const listExamplesQuery = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export const listExamplesSchemas = { query: listExamplesQuery };
export const getExampleSchemas = { params: exampleIdParams };
export const createExampleSchemas = { body: createExampleBody };

/* ------------------------------ OpenAPI ------------------------------ */

registry.registerPath({
  method: 'get',
  path: '/v1/examples',
  tags: ['Example'],
  summary: 'List examples',
  security: [{ identityAuth: [] }],
  request: { query: listExamplesQuery },
  responses: {
    200: {
      description: 'List of examples',
      content: {
        'application/json': {
          schema: z.object({ data: z.array(exampleSchema) }),
        },
      },
    },
    401: { description: 'Not authenticated' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/v1/examples/{exampleId}',
  tags: ['Example'],
  summary: 'Get an example by id',
  security: [{ identityAuth: [] }],
  request: { params: exampleIdParams },
  responses: {
    200: {
      description: 'The example',
      content: {
        'application/json': { schema: z.object({ data: exampleSchema }) },
      },
    },
    404: { description: 'Example not found' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/v1/examples',
  tags: ['Example'],
  summary: 'Create an example',
  security: [{ identityAuth: [] }],
  request: {
    body: {
      content: { 'application/json': { schema: createExampleBody } },
    },
  },
  responses: {
    201: {
      description: 'Created example',
      content: {
        'application/json': { schema: z.object({ data: exampleSchema }) },
      },
    },
    400: { description: 'Validation error' },
    403: { description: 'Missing examples:create permission' },
    409: { description: 'Code already exists' },
  },
});
