import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import {
  errorHandler,
  notFoundHandler,
} from './common/middlewares/error-handler.js';
import { requestLogger } from './common/middlewares/request-logger.js';
import { config } from './config/index.js';
import { createDocsRouter } from './openapi/router.js';
import { router } from './router.js';

/**
 * Assembles the Express app. Exported as a factory so tests can build
 * an app instance without opening a port or touching the database.
 */
export function createApp(): Express {
  const app = express();

  // Running behind a load balancer / reverse proxy
  app.set('trust proxy', 1);

  app.use(requestLogger);
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  if (config.docsEnabled) {
    app.use(createDocsRouter());
  }

  app.use(router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
