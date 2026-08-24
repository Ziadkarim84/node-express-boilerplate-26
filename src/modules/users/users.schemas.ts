import { z } from 'zod';
import { registry } from '../../openapi/registry.js';

/**
 * Module convention: every request/response shape is a Zod schema here.
 * The same schema drives runtime validation (validate middleware),
 * static types (z.infer), and the OpenAPI docs (registerPath below).
 */

export const userSchema = z
  .object({
    id: z.number().int(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.email(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi('User');

export const createUserBody = z
  .object({
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    email: z.email().max(255),
  })
  .openapi('CreateUserInput');

export type CreateUserInput = z.infer<typeof createUserBody>;

export const userIdParams = z.object({
  userId: z.coerce.number().int().positive(),
});

export const listUsersQuery = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export const listUsersSchemas = { query: listUsersQuery };
export const getUserSchemas = { params: userIdParams };
export const createUserSchemas = { body: createUserBody };

/* ------------------------------ OpenAPI ------------------------------ */

registry.registerPath({
  method: 'get',
  path: '/v1/users',
  tags: ['Users'],
  summary: 'List users',
  request: { query: listUsersQuery },
  responses: {
    200: {
      description: 'List of users',
      content: {
        'application/json': {
          schema: z.object({ data: z.array(userSchema) }),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/v1/users/{userId}',
  tags: ['Users'],
  summary: 'Get a user by id',
  request: { params: userIdParams },
  responses: {
    200: {
      description: 'The user',
      content: {
        'application/json': { schema: z.object({ data: userSchema }) },
      },
    },
    404: { description: 'User not found' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/v1/users',
  tags: ['Users'],
  summary: 'Create a user',
  request: {
    body: {
      content: { 'application/json': { schema: createUserBody } },
    },
  },
  responses: {
    201: {
      description: 'Created user',
      content: {
        'application/json': { schema: z.object({ data: userSchema }) },
      },
    },
    400: { description: 'Validation error' },
    409: { description: 'Email already in use' },
  },
});
