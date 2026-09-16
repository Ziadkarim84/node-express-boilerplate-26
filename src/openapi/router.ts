import { apiReference } from '@scalar/express-api-reference';
import { Router } from 'express';
import helmet from 'helmet';
import { buildOpenApiDocument } from './registry.js';

// /openapi.json + interactive docs at /docs (Scalar). Mounted only when
// config.docsEnabled (default: everywhere except production).
export function createDocsRouter(): Router {
  const router = Router();
  const document = buildOpenApiDocument();

  router.get('/openapi.json', (_req, res) => {
    res.json(document);
  });

  // Scalar is a single-page app served from jsDelivr with an inline config
  // script, which the global Helmet CSP (script-src 'self') blocks. Override
  // the policy for this route only; the API itself keeps the strict one.
  const scalarCsp = helmet.contentSecurityPolicy({
    useDefaults: true,
    directives: {
      'script-src': ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
      'style-src': [
        "'self'",
        "'unsafe-inline'",
        'https://cdn.jsdelivr.net',
        'https://fonts.googleapis.com',
      ],
      'font-src': ["'self'", 'https:', 'data:'],
      'img-src': ["'self'", 'data:', 'https:'],
      'connect-src': ["'self'", 'https://cdn.jsdelivr.net'],
      'worker-src': ["'self'", 'blob:'],
    },
  });

  router.use(
    '/docs',
    scalarCsp,
    apiReference({
      url: '/openapi.json',
      pageTitle: 'API Reference',
    }),
  );

  return router;
}
