/**
 * HexaScan Backend API
 * Main entry point
 */

import 'dotenv/config';
import { createApp } from './app.js';
import { config } from './config/index.js';
import { disconnectDatabase } from './core/database/client.js';
import { disconnectRedis } from './core/cache/redis.js';
import { queueManager } from './core/queue/queue-manager.js';
import { checkExecutionEngine } from './core/checks/check-executor.js';
import { initAlertTriggerService } from './core/alerts/index.js';
import { escalationScheduler, planExpirationScheduler } from './core/scheduler/index.js';
import { initializeRepoScanWorker, closeRepoScanWorker } from './core/security-scanner/index.js';
import { systemConfigService } from './core/config/index.js';

const start = async () => {
  try {
    const app = await createApp();

    // Initialize system configuration from database
    app.log.info('Initializing system configuration...');
    await systemConfigService.initialize();

    // Initialize queue infrastructure
    app.log.info('Initializing queue infrastructure...');
    await queueManager.initializeCheckQueue();

    // Initialize alert trigger service
    app.log.info('Initializing alert trigger service...');
    const alertService = initAlertTriggerService(app);
    app.log.info(`AlertTriggerService initialized: ${alertService ? 'SUCCESS' : 'FAILED (null)'}`);

    // Start check execution worker
    app.log.info('Starting check execution worker...');
    await checkExecutionEngine.startWorker();

    // Start repo scan worker
    app.log.info('Starting repo scan worker...');
    await queueManager.initializeRepoScanQueue();
    await initializeRepoScanWorker();

    // Start escalation scheduler
    app.log.info('Starting escalation scheduler...');
    await escalationScheduler.initialize();

    // Start plan expiration scheduler
    app.log.info('Starting plan expiration scheduler...');
    await planExpirationScheduler.initialize();

    // Start listening
    const port = Number(process.env.API_PORT) || config.server.port;
    const host = process.env.API_HOST || config.server.host;

    await app.listen({ port, host });

    app.log.info(`Server listening on ${host}:${port}`);
    app.log.info(`Environment: ${process.env.NODE_ENV || 'development'}`);

    // Handle graceful shutdown
    const shutdown = async (signal: string) => {
      app.log.info(`Received ${signal}, shutting down gracefully...`);

      try {
        // Stop plan expiration scheduler
        app.log.info('Stopping plan expiration scheduler...');
        await planExpirationScheduler.stop();

        // Stop escalation scheduler
        app.log.info('Stopping escalation scheduler...');
        await escalationScheduler.stop();

        // Stop check execution worker
        app.log.info('Stopping check execution worker...');
        await checkExecutionEngine.stopWorker();

        // Stop repo scan worker
        app.log.info('Stopping repo scan worker...');
        await closeRepoScanWorker();

        // Close queue connections
        app.log.info('Closing queue connections...');
        await queueManager.close();

        // Stop accepting new requests
        await app.close();

        // Disconnect from database
        await disconnectDatabase();

        // Disconnect from Redis
        await disconnectRedis();

        app.log.info('Shutdown complete');
        process.exit(0);
      } catch (error) {
        app.log.error({ error }, 'Error during shutdown');
        process.exit(1);
      }
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught errors
    process.on('uncaughtException', (error: Error) => {
      app.log.error({ error: error.message, stack: error.stack }, 'Uncaught exception');
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
      app.log.error({ reason, promise: String(promise) }, 'Unhandled rejection');
      shutdown('unhandledRejection');
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

start();
