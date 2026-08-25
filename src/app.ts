import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import {
  errorHandler,
  notFoundHandler,
} from './common/middlewares/error-handler.js';
import { requestLogger } from './common/middlewares/request-logger.js';
import { sessionMiddleware } from './common/middlewares/session.js';
import { config } from './config/index.js';
import { createDocsRouter } from './openapi/router.js';
import { router } from './router.js';

// App factory — lets tests build the app without a port or DB.
export function createApp(): Express {
  const app = express();

  // Running behind a load balancer / reverse proxy
  app.set('trust proxy', 1);

  app.use(requestLogger);
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser(config.cookie.secret));

  // Resolves the caller (JWT / bearer token / cookie) into req.user.
  // Enforcement happens per-route via authorize()/authorizeRoles().
  app.use(sessionMiddleware);

  if (config.docsEnabled) {
    app.use(createDocsRouter());
  }

  app.use(router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
