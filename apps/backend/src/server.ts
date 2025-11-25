/**
 * OpenTakeOff Fastify Server Factory
 * Creates and configures the Fastify server instance with plugins
 */

import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import multipart from '@fastify/multipart';
import websocket from '@fastify/websocket';
import { config, isDev } from './config.js';

/**
 * Server factory options
 */
export interface CreateServerOptions {
  /**
   * Override logger configuration
   */
  logger?: FastifyServerOptions['logger'];
}

/**
 * Create and configure Fastify server instance
 * Registers all required plugins and middleware
 *
 * @param options - Server configuration options
 * @returns Configured Fastify instance
 */
export async function createServer(
  options: CreateServerOptions = {},
): Promise<FastifyInstance> {
  // Create Fastify instance with Pino logger
  const fastify = Fastify({
    logger:
      options.logger ??
      (isDev
        ? {
            transport: {
              target: 'pino-pretty',
              options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
              },
            },
          }
        : true),
    disableRequestLogging: false,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'reqId',
  });

  // Register sensible plugin first (provides useful utilities and HTTP errors)
  await fastify.register(sensible);

  // Register CORS plugin
  await fastify.register(cors, {
    origin: true, // Allow all origins (can be restricted later)
    credentials: true,
  });

  // Register Helmet for security headers
  // CSP disabled to support pdf.js static file serving
  await fastify.register(helmet, {
    contentSecurityPolicy: false,
    global: true,
  });

  // Register rate limiting for DoS protection
  await fastify.register(rateLimit, {
    max: 100, // 100 requests
    timeWindow: '1 minute',
    cache: 10000, // Cache 10k rate limit checks
    allowList: ['127.0.0.1'], // Whitelist localhost
  });

  // Register multipart plugin for file uploads
  await fastify.register(multipart, {
    limits: {
      fileSize: config.PDF_MAX_SIZE_MB * 1024 * 1024, // Convert MB to bytes
      files: 1, // Only allow 1 file per request
      fields: 10, // Limit form fields to prevent abuse
    },
    // Don't throw immediately on file size limit
    // Instead, we'll check manually to provide better error messages
    throwFileSizeLimit: true,
  });

  // Register WebSocket plugin
  await fastify.register(websocket);

  // Register Swagger for OpenAPI documentation
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'OpenTakeOff API',
        description: 'API for construction/electrical plan take-offs',
        version: '0.1.0',
      },
      servers: [
        {
          url: `http://localhost:${config.PORT}`,
          description: 'Development server',
        },
      ],
      tags: [
        { name: 'health', description: 'Health check endpoints' },
        { name: 'projects', description: 'Project management' },
        { name: 'plans', description: 'Plan upload and management' },
      ],
    },
  });

  // Register Swagger UI for API documentation interface
  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
    staticCSP: true,
  });

  // Log registered routes on startup (development only)
  if (isDev) {
    fastify.addHook('onReady', async function () {
      await Promise.resolve();
      const routes = fastify.printRoutes();
      this.log.info('Registered routes:\n' + routes);
    });
  }

  return fastify;
}
