import { apiReference } from '@scalar/express-api-reference';
import { Router } from 'express';
import { buildOpenApiDocument } from './registry.js';

/**
 * Serves the raw OpenAPI spec at /openapi.json and interactive API docs
 * at /docs (Scalar UI). Mounted only when config.docsEnabled is true
 * (default: everywhere except production).
 */
export function createDocsRouter(): Router {
  const router = Router();
  const document = buildOpenApiDocument();

  router.get('/openapi.json', (_req, res) => {
    res.json(document);
  });

  router.use(
    '/docs',
    apiReference({
      url: '/openapi.json',
      pageTitle: 'API Reference',
    }),
  );

  return router;
}
