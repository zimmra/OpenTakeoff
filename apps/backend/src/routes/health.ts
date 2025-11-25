/**
 * Health Check Routes
 * Provides /healthz and /readyz endpoints for monitoring
 */

import { type FastifyInstance, type FastifyPluginOptions } from 'fastify';
import { config } from '../config.js';

/**
 * Health check response schema
 */
interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
  uptime?: number;
  environment?: string;
  metrics?: boolean;
}

/**
 * Register health check routes
 *
 * @param fastify - Fastify instance
 * @param options - Plugin options
 */
export async function healthRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  await Promise.resolve();
  /**
   * Liveness probe - checks if the application is running
   * Returns 200 if the server is alive
   */
  fastify.get<{ Reply: HealthResponse }>(
    '/healthz',
    {
      schema: {
        description: 'Liveness probe - checks if the application is running',
        tags: ['health'],
        response: {
          200: {
            description: 'Server is alive',
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['ok'] },
              timestamp: { type: 'string', format: 'date-time' },
              uptime: { type: 'number', description: 'Process uptime in seconds' },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      return reply.send({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
      });
    },
  );

  /**
   * Readiness probe - checks if the application is ready to serve traffic
   * Returns 200 if the server is ready, 503 if not
   *
   * Can be extended to check database connectivity, external services, etc.
   */
  fastify.get<{ Reply: HealthResponse }>(
    '/readyz',
    {
      schema: {
        description:
          'Readiness probe - checks if the application is ready to serve traffic',
        tags: ['health'],
        response: {
          200: {
            description: 'Server is ready',
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['ok'] },
              timestamp: { type: 'string', format: 'date-time' },
              uptime: { type: 'number' },
              environment: { type: 'string' },
              metrics: { type: 'boolean' },
            },
          },
          503: {
            description: 'Server is not ready',
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['error'] },
              timestamp: { type: 'string' },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      // TODO: Add database connectivity check when Task 4 is implemented
      // TODO: Add other readiness checks as needed

      // const isReady = true; // Will be expanded with actual checks

      // if (!isReady) {
      //   return reply.code(503).send({
      //     status: 'error' as const,
      //     timestamp: new Date().toISOString(),
      //   });
      // }

      return reply.send({
        status: 'ok' as const,
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        environment: config.NODE_ENV,
        metrics: config.ENABLE_METRICS,
      });
    },
  );
}
