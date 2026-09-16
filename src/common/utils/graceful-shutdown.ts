import type { Server } from 'node:http';
import { config } from '../../config/index.js';
import { closeDatabase } from '../../db/index.js';
import { closeRedis } from '../libs/redis.js';
import { logger } from '../logger/index.js';

// On SIGINT/SIGTERM/SIGHUP: flip readiness to 503, give the load balancer a
// moment to notice, stop accepting connections, drain in-flight requests,
// close the DB; force-exit after SHUTDOWN_TIMEOUT_MS.
let shuttingDown = false;

/** True once a shutdown signal was received; readiness reports 503 then. */
export function isShuttingDown(): boolean {
  return shuttingDown;
}

export function setupGracefulShutdown(server: Server): void {
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
      // Readiness already answers 503; let the LB drain us before closing.
      setTimeout(() => {
        server.close((err) => (err ? reject(err) : resolve()));
      }, config.shutdownDrainDelayMs).unref();
    });

    closeServer
      .then(() => Promise.all([closeDatabase(), closeRedis()]))
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
