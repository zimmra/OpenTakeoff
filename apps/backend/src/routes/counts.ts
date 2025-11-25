/**
 * Count Routes
 * RESTful endpoints for stamp count aggregations with ETag caching
 */

import { type FastifyInstance, type FastifyPluginOptions, type FastifyRequest, type FastifyReply } from 'fastify';
import { createHash } from 'node:crypto';
import { getDatabase } from '../db/client.js';
import {
  createCountService,
  createPlanService,
  ServiceError,
  ServiceErrorCode,
} from '../services/data/index.js';
import type { CountsResponse } from '../services/data/countService.js';

/**
 * Type definitions for route parameters
 */
interface PlanIdParams {
  planId: string;
}

/**
 * Generate ETag from counts response
 */
function generateETag(counts: CountsResponse): string {
  const hash = createHash('sha256');
  // Hash the updated timestamp and totals for fast comparison
  hash.update(counts.updatedAt.toISOString());
  hash.update(JSON.stringify(counts.totals));
  return `"${hash.digest('hex')}"`;
}

/**
 * Map ServiceError to HTTP status code
 */
function mapServiceErrorToHttpCode(error: ServiceError): number {
  if (error.code === ServiceErrorCode.NOT_FOUND) {
    return 404;
  }
  if (error.code === ServiceErrorCode.INVALID_INPUT) {
    return 400;
  }
  return 500;
}

/**
 * Register count routes
 */
export async function countRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  await Promise.resolve();
  /**
   * GET /plans/:planId/counts - Get aggregated counts for a plan
   */
  fastify.get<{ Params: PlanIdParams }>(
    '/plans/:planId/counts',
    {
      schema: {
        description:
          'Get real-time aggregated stamp counts per device and location with ETag caching support',
        tags: ['counts'],
        params: {
          type: 'object',
          required: ['planId'],
          properties: {
            planId: { type: 'string', description: 'Plan ID' },
          },
        },
        headers: {
          type: 'object',
          properties: {
            'if-none-match': {
              type: 'string',
              description: 'ETag from previous response for conditional caching',
            },
          },
        },
        response: {
          200: {
            description: 'Aggregated counts returned',
            type: 'object',
            properties: {
              planId: { type: 'string' },
              counts: {
                type: 'array',
                description: 'Per-device per-location counts',
                items: {
                  type: 'object',
                  properties: {
                    deviceId: { type: 'string' },
                    deviceName: { type: 'string' },
                    locationId: { type: 'string', nullable: true },
                    locationName: { type: 'string', nullable: true },
                    total: { type: 'number' },
                  },
                },
              },
              totals: {
                type: 'array',
                description: 'Totals per device across all locations',
                items: {
                  type: 'object',
                  properties: {
                    deviceId: { type: 'string' },
                    deviceName: { type: 'string' },
                    total: { type: 'number' },
                  },
                },
              },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
          304: {
            description: 'Not modified - client cache is current',
            type: 'null',
          },
          404: {
            description: 'Plan not found',
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: PlanIdParams }>, reply: FastifyReply) => {
      try {
        const { planId } = request.params;

        // Get database and services
        const { db } = await getDatabase();
        const planService = createPlanService(db);
        const countService = createCountService(db);

        // Check if plan exists
        const plan = await planService.getById(planId);
        if (!plan) {
          return reply.code(404).send({
            error: 'Plan not found',
          });
        }

        // Get counts
        const counts = await countService.getCountsForPlan(planId);

        // Generate ETag
        const etag = generateETag(counts);

        // Check If-None-Match header for conditional caching
        const clientETag = request.headers['if-none-match'];
        if (clientETag && clientETag === etag) {
          // Client cache is current, return 304 Not Modified
          return reply.code(304).header('ETag', etag).send();
        }

        // Return counts with ETag
        return reply
          .code(200)
          .header('ETag', etag)
          .header('Cache-Control', 'private, must-revalidate')
          .send(counts);
      } catch (error) {
        if (error instanceof ServiceError) {
          const statusCode = mapServiceErrorToHttpCode(error);
          return reply.code(statusCode).send({ error: error.message });
        }

        fastify.log.error({ error }, 'Failed to get counts');
        throw error;
      }
    },
  );

  /**
   * POST /plans/:planId/counts/recompute - Trigger full recomputation
   */
  fastify.post<{ Params: PlanIdParams }>(
    '/plans/:planId/counts/recompute',
    {
      schema: {
        description:
          'Manually trigger full count recomputation for a plan (useful for data integrity recovery)',
        tags: ['counts'],
        params: {
          type: 'object',
          required: ['planId'],
          properties: {
            planId: { type: 'string', description: 'Plan ID' },
          },
        },
        response: {
          200: {
            description: 'Counts recomputed successfully',
            type: 'object',
            properties: {
              planId: { type: 'string' },
              rowsUpdated: { type: 'number' },
              message: { type: 'string' },
            },
          },
          404: {
            description: 'Plan not found',
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: PlanIdParams }>, reply: FastifyReply) => {
      try {
        const { planId } = request.params;

        // Get database and services
        const { db } = await getDatabase();
        const planService = createPlanService(db);
        const countService = createCountService(db);

        // Check if plan exists
        const plan = await planService.getById(planId);
        if (!plan) {
          return reply.code(404).send({
            error: 'Plan not found',
          });
        }

        // Trigger recomputation
        const rowsUpdated = await countService.recomputeCountsForPlan(planId);

        fastify.log.info({ planId, rowsUpdated }, 'Counts recomputed for plan');

        return reply.code(200).send({
          planId,
          rowsUpdated,
          message: `Successfully recomputed ${rowsUpdated} count aggregations`,
        });
      } catch (error) {
        if (error instanceof ServiceError) {
          const statusCode = mapServiceErrorToHttpCode(error);
          return reply.code(statusCode).send({ error: error.message });
        }

        fastify.log.error({ error }, 'Failed to recompute counts');
        throw error;
      }
    },
  );
}
