import type { Server } from 'node:http';
import { config } from '../../config/index.js';
import { closeDatabase } from '../../db/index.js';
import { closeRedis } from '../libs/redis.js';
import { logger } from '../logger/index.js';

// On SIGINT/SIGTERM/SIGHUP: stop accepting connections, drain in-flight
// requests, close the DB; force-exit after SHUTDOWN_TIMEOUT_MS.
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

    Promise.all([closeServer, closeDatabase(), closeRedis()])
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
