import { z } from 'zod';
import { registry } from '../../openapi/registry.js';
import { okSchema } from '../../common/utils/response.js';

const sessionUserSchema = z
  .object({
    id: z.number().int(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.email().optional(),
    phone: z.string().optional(),
    roleIds: z.array(z.number().int()),
    scopeIds: z.array(z.string()).nullable(),
    permissions: z.array(z.string()).optional(),
  })
  .openapi('SessionUser');

registry.registerComponent('securitySchemes', 'identityAuth', {
  type: 'http',
  scheme: 'bearer',
  description:
    'Credentials issued by the ShopUp identity service. Accepted as ' +
    '`Authorization: bearer <session-token>`, `Authorization: jwt <RS256 JWT>`, ' +
    '`X-Access-Token`, or the signed auth cookie. Log in via the identity ' +
    'service — this service does not issue tokens.',
});

registry.registerPath({
  method: 'get',
  path: '/v1/auth/me',
  tags: ['Auth'],
  summary: 'Current authenticated principal (via identity service)',
  security: [{ identityAuth: [] }],
  responses: {
    200: {
      description: 'The authenticated user',
      content: {
        'application/json': {
          schema: okSchema(sessionUserSchema),
        },
      },
    },
    401: { description: 'Not authenticated' },
  },
});
