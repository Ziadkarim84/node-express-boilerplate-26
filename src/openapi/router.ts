import { apiReference } from '@scalar/express-api-reference';
import { Router } from 'express';
import { buildOpenApiDocument } from './registry.js';

// /openapi.json + interactive docs at /docs (Scalar). Mounted only when
// config.docsEnabled (default: everywhere except production).
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
