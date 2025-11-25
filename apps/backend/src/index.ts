/**
 * OpenTakeOff Backend Entry Point
 * Initializes and starts the Fastify server with graceful shutdown
 */

import closeWithGrace from 'close-with-grace';
import { createServer } from './server.js';
import { config } from './config.js';

// Routes
import { healthRoutes } from './routes/health.js';
import { projectRoutes } from './routes/projects.js';
import { planRoutes } from './routes/plans.js';
import { deviceRoutes } from './routes/devices.js';
import { locationRoutes } from './routes/locations.js';
import { stampRoutes } from './routes/stamps.js';
import { countRoutes } from './routes/counts.js';
import { exportRoutes } from './routes/exports.js';
import { historyRoutes } from './routes/history.js';
import { projectStateRoutes } from './routes/projectState.js';
import { countEventRoutes } from './routes/countEvents.js';

/**
 * Main application bootstrap
 */
async function main() {
  // Create server instance
  const server = await createServer();

  // Register routes
  // Health routes (root level)
  await server.register(healthRoutes);

  // All API routes are prefixed with /api
  await server.register(async (api) => {
    await api.register(projectRoutes);
    await api.register(planRoutes);
    await api.register(deviceRoutes);
    await api.register(locationRoutes);
    await api.register(stampRoutes);
    await api.register(countRoutes);
    await api.register(exportRoutes);
    await api.register(historyRoutes);
    await api.register(projectStateRoutes);
    await api.register(countEventRoutes);
  }, { prefix: '/api' });

  // Graceful shutdown handler
  const closeListeners = closeWithGrace(
    { delay: 500 }, // 500ms delay before forcing shutdown
    async ({ signal, err, manual }) => {
      if (err) {
        server.log.error({ err }, 'Uncaught error, forcing shutdown');
      } else if (manual) {
        server.log.info('Manual shutdown triggered');
      } else {
        server.log.info({ signal }, `${signal} received, starting graceful shutdown`);
      }

      await server.close();
      server.log.info('Server closed successfully');
    },
  );

  // Uninstall graceful shutdown handlers
  server.addHook('onClose', (_instance, done) => {
    closeListeners.uninstall();
    done();
  });

  // Start server
  try {
    await server.listen({
      port: config.PORT,
      host: '0.0.0.0', // Listen on all interfaces (required for Docker)
    });

    server.log.info(`🚀 Server ready at http://localhost:${config.PORT}`);
    server.log.info(`📚 API docs available at http://localhost:${config.PORT}/docs`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Bootstrap application
main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
