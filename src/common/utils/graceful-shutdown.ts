import type { Server } from 'node:http';
import { config } from '../../config/index.js';
import { closeDatabase } from '../../db/index.js';
import { logger } from '../logger/index.js';

/**
 * Graceful shutdown on SIGINT/SIGTERM/SIGHUP:
 *  1. stop accepting new connections
 *  2. let in-flight requests finish and close external connections (DB)
 *  3. force-exit after SHUTDOWN_TIMEOUT_MS if anything hangs
 */
export function setupGracefulShutdown(server: Server): void {
  let shuttingDown = false;

  const shutdown = (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info(`Received ${signal}, shutting down gracefully...`);

    const forceExit = setTimeout(() => {
      logger.error('Graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, config.shutdownTimeoutMs);
    forceExit.unref();

    const closeServer = new Promise<void>((resolve, reject) => {
      if (!server.listening) return resolve();
      server.close((err) => (err ? reject(err) : resolve()));
    });

    Promise.all([closeServer, closeDatabase()])
      .then(() => {
        logger.info('Shutdown complete');
        process.exit(0);
      })
      .catch((err: unknown) => {
        logger.error({ err }, 'Error during graceful shutdown');
        process.exit(1);
      });
  };

  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGHUP'];
  for (const signal of signals) {
    process.on(signal, shutdown);
  }
}
