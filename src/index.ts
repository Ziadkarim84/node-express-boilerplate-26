import http from 'node:http';
import { createApp } from './app.js';
import { logger } from './common/logger/index.js';
import { setupGracefulShutdown } from './common/utils/graceful-shutdown.js';
import { config } from './config/index.js';
import { initializeDatabase } from './db/index.js';

/**
 * Process entrypoint: config is validated on import (fails fast),
 * then DB connectivity is verified before the server accepts traffic.
 */
async function main(): Promise<void> {
  await initializeDatabase();

  const app = createApp();
  const server = http.createServer(app);

  setupGracefulShutdown(server);

  server.listen(config.port, () => {
    logger.info(
      `${config.appName} listening on port ${config.port} (${config.env})`,
    );
    if (config.docsEnabled) {
      logger.info(`API docs available at http://localhost:${config.port}/docs`);
    }
  });
}

// A thrown uncaught exception means unknown state — log and crash;
// the orchestrator (Docker/k8s/pm2) restarts the process.
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled promise rejection');
  process.exit(1);
});

main().catch((err: unknown) => {
  logger.fatal({ err }, 'Failed to start application');
  process.exit(1);
});
