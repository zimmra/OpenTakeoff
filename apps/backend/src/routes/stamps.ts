/**
 * Stamp Routes
 * RESTful endpoints for stamp placement management with optimistic locking
 */

import { type FastifyInstance, type FastifyPluginOptions, type FastifyRequest, type FastifyReply } from 'fastify';
import { z } from 'zod';
import { getDatabase } from '../db/client.js';
import {
  createStampService,
  createPlanService,
  ServiceError,
  ServiceErrorCode,
  OptimisticLockError,
  type PaginationParams,
  type StampPosition,
} from '../services/data/index.js';
import { buildLinkHeader, extractQueryParams } from '../utils/pagination.js';

/**
 * Zod Schemas for Validation
 */

// Pagination query schema
const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
});

// Position schema
const positionSchema = z.object({
  page: z.number().int().min(1).optional(),
  x: z.number(),
  y: z.number(),
  scale: z.number().positive().optional(),
});

// Stamp create schema
const createStampSchema = z.object({
  deviceId: z.string().uuid(),
  locationId: z.string().uuid().optional(),
  position: positionSchema,
});

// Stamp update schema
const updateStampSchema = z.object({
  position: positionSchema.optional(),
  locationId: z.string().uuid().optional().nullable(),
  updatedAt: z.string().datetime().optional(), // ISO 8601 timestamp for optimistic locking
});

/**
 * Type definitions for route parameters
 */
interface PlanIdParams {
  planId: string;
}

interface StampIdParams {
  planId: string;
  stampId: string;
}

interface ListStampsQuery {
  limit?: number;
  cursor?: string;
  [key: string]: unknown;
}

interface CreateStampBody {
  deviceId: string;
  locationId?: string;
  position: StampPosition;
}

interface UpdateStampBody {
  position?: StampPosition;
  locationId?: string | null;
  updatedAt?: string;
}

/**
 * Map ServiceError to HTTP status code
 */
function mapServiceErrorToHttpCode(error: ServiceError): number {
  if (error instanceof OptimisticLockError) {
    return 409;
  }

  switch (error.code) {
    case ServiceErrorCode.NOT_FOUND:
      return 404;
    case ServiceErrorCode.ALREADY_EXISTS:
      return 409;
    case ServiceErrorCode.INVALID_INPUT:
      return 400;
    case ServiceErrorCode.FOREIGN_KEY_VIOLATION:
      return 400;
    case ServiceErrorCode.DATABASE_ERROR:
    default:
      return 500;
  }
}

/**
 * Register stamp routes
 */
export async function stampRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  await Promise.resolve();
  /**
   * GET /plans/:planId/stamps - List stamps for a plan
   */
  fastify.get<{ Params: PlanIdParams; Querystring: ListStampsQuery }>(
    '/plans/:planId/stamps',
    {
      schema: {
        description: 'List all stamps for a specific plan with pagination',
        tags: ['stamps'],
        params: {
          type: 'object',
          required: ['planId'],
          properties: {
            planId: { type: 'string', description: 'Plan ID' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              minimum: 1,
              maximum: 100,
              description: 'Maximum number of stamps to return (default: 50)',
            },
            cursor: {
              type: 'string',
              description: 'Cursor for pagination (ID of last item from previous page)',
            },
          },
        },
        response: {
          200: {
            description: 'List of stamps for the plan',
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    planId: { type: 'string' },
                    deviceId: { type: 'string' },
                    locationId: { type: 'string', nullable: true },
                    position: {
                      type: 'object',
                      properties: {
                        page: { type: 'number' },
                        x: { type: 'number' },
                        y: { type: 'number' },
                        scale: { type: 'number' },
                      },
                    },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                  },
                },
              },
              pagination: {
                type: 'object',
                properties: {
                  count: { type: 'number' },
                  nextCursor: { type: 'string', nullable: true },
                  hasMore: { type: 'boolean' },
                },
              },
            },
          },
          400: {
            description: 'Invalid query parameters',
            type: 'object',
            properties: {
              error: { type: 'string' },
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
    async (
      request: FastifyRequest<{ Params: PlanIdParams; Querystring: ListStampsQuery }>,
      reply: FastifyReply,
    ) => {
      try {
        const { planId } = request.params;

        // Validate query parameters
        const queryResult = paginationQuerySchema.safeParse(request.query);
        if (!queryResult.success) {
          return reply.code(400).send({
            error: 'Invalid query parameters',
            details: queryResult.error.issues,
          });
        }

        const params: PaginationParams = queryResult.data;

        // Get database and services
        const { db } = await getDatabase();
        const planService = createPlanService(db);
        const stampService = createStampService(db);

        // Check if plan exists
        const plan = await planService.getById(planId);
        if (!plan) {
          return reply.code(404).send({
            error: 'Plan not found',
          });
        }

        // List stamps for plan
        const result = await stampService.listByPlan(planId, params);

        // Add Link header for pagination if there's a next page
        const linkHeader = buildLinkHeader(
          `/plans/${planId}/stamps`,
          extractQueryParams(request.query),
          result.pagination.nextCursor,
        );

        if (linkHeader) {
          reply.header('Link', linkHeader);
        }

        return reply.send(result);
      } catch (error) {
        if (error instanceof ServiceError) {
          const statusCode = mapServiceErrorToHttpCode(error);
          return reply.code(statusCode).send({ error: error.message });
        }

        fastify.log.error({ error }, 'Failed to list stamps');
        throw error;
      }
    },
  );

  /**
   * POST /plans/:planId/stamps - Create a new stamp
   */
  fastify.post<{ Params: PlanIdParams; Body: CreateStampBody }>(
    '/plans/:planId/stamps',
    {
      schema: {
        description: 'Create a new stamp placement on a plan (transactional with revision tracking)',
        tags: ['stamps'],
        params: {
          type: 'object',
          required: ['planId'],
          properties: {
            planId: { type: 'string', description: 'Plan ID' },
          },
        },
        body: {
          type: 'object',
          required: ['deviceId', 'position'],
          properties: {
            deviceId: { type: 'string', format: 'uuid' },
            locationId: { type: 'string', format: 'uuid' },
            position: {
              type: 'object',
              required: ['x', 'y'],
              properties: {
                page: { type: 'number', minimum: 1 },
                x: { type: 'number' },
                y: { type: 'number' },
                scale: { type: 'number', minimum: 0, exclusiveMinimum: 0 },
              },
            },
          },
        },
        response: {
          201: {
            description: 'Stamp created successfully',
            type: 'object',
            properties: {
              id: { type: 'string' },
              planId: { type: 'string' },
              deviceId: { type: 'string' },
              locationId: { type: 'string', nullable: true },
              position: {
                type: 'object',
                properties: {
                  page: { type: 'number' },
                  x: { type: 'number' },
                  y: { type: 'number' },
                  scale: { type: 'number' },
                },
              },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
          400: {
            description: 'Invalid request body or foreign key violation',
            type: 'object',
            properties: {
              error: { type: 'string' },
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
    async (
      request: FastifyRequest<{ Params: PlanIdParams; Body: CreateStampBody }>,
      reply: FastifyReply,
    ) => {
      try {
        const { planId } = request.params;

        // Validate body
        const bodyResult = createStampSchema.safeParse(request.body);
        if (!bodyResult.success) {
          return reply.code(400).send({
            error: 'Invalid request body',
            details: bodyResult.error.issues,
          });
        }

        const input = bodyResult.data;

        // Get database and services
        const { db } = await getDatabase();
        const planService = createPlanService(db);
        const stampService = createStampService(db);

        // Check if plan exists
        const plan = await planService.getById(planId);
        if (!plan) {
          return reply.code(404).send({
            error: 'Plan not found',
          });
        }

        // Create stamp (transactional with revision)
        const stamp = await stampService.create({
          planId,
          deviceId: input.deviceId,
          position: input.position,
          locationId: input.locationId,
        });

        fastify.log.info(
          { stampId: stamp.id, planId, deviceId: stamp.deviceId },
          'Stamp created with revision',
        );

        return reply.code(201).send(stamp);
      } catch (error) {
        if (error instanceof ServiceError) {
          const statusCode = mapServiceErrorToHttpCode(error);
          return reply.code(statusCode).send({ error: error.message });
        }

        fastify.log.error({ error }, 'Failed to create stamp');
        throw error;
      }
    },
  );

  /**
   * GET /plans/:planId/stamps/:stampId - Get a stamp by ID
   */
  fastify.get<{ Params: StampIdParams }>(
    '/plans/:planId/stamps/:stampId',
    {
      schema: {
        description: 'Get a stamp by ID',
        tags: ['stamps'],
        params: {
          type: 'object',
          required: ['planId', 'stampId'],
          properties: {
            planId: { type: 'string', description: 'Plan ID' },
            stampId: { type: 'string', description: 'Stamp ID' },
          },
        },
        response: {
          200: {
            description: 'Stamp found',
            type: 'object',
            properties: {
              id: { type: 'string' },
              planId: { type: 'string' },
              deviceId: { type: 'string' },
              locationId: { type: 'string', nullable: true },
              position: {
                type: 'object',
                properties: {
                  page: { type: 'number' },
                  x: { type: 'number' },
                  y: { type: 'number' },
                  scale: { type: 'number' },
                },
              },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
          404: {
            description: 'Stamp not found',
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: StampIdParams }>, reply: FastifyReply) => {
      try {
        const { stampId } = request.params;

        // Get database and service
        const { db } = await getDatabase();
        const stampService = createStampService(db);

        // Get stamp
        const stamp = await stampService.getById(stampId);

        if (!stamp) {
          return reply.code(404).send({
            error: 'Stamp not found',
          });
        }

        return reply.send(stamp);
      } catch (error) {
        if (error instanceof ServiceError) {
          const statusCode = mapServiceErrorToHttpCode(error);
          return reply.code(statusCode).send({ error: error.message });
        }

        fastify.log.error({ error }, 'Failed to get stamp');
        throw error;
      }
    },
  );

  /**
   * PATCH /plans/:planId/stamps/:stampId - Update a stamp
   */
  fastify.patch<{ Params: StampIdParams; Body: UpdateStampBody }>(
    '/plans/:planId/stamps/:stampId',
    {
      schema: {
        description: 'Update a stamp with optimistic locking support (transactional with revision tracking)',
        tags: ['stamps'],
        params: {
          type: 'object',
          required: ['planId', 'stampId'],
          properties: {
            planId: { type: 'string', description: 'Plan ID' },
            stampId: { type: 'string', description: 'Stamp ID' },
          },
        },
        body: {
          type: 'object',
          properties: {
            position: {
              type: 'object',
              required: ['x', 'y'],
              properties: {
                page: { type: 'number', minimum: 1 },
                x: { type: 'number' },
                y: { type: 'number' },
                scale: { type: 'number', minimum: 0, exclusiveMinimum: 0 },
              },
            },
            locationId: { type: 'string', format: 'uuid', nullable: true },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'For optimistic locking - must match current updatedAt',
            },
          },
        },
        response: {
          200: {
            description: 'Stamp updated successfully',
            type: 'object',
            properties: {
              id: { type: 'string' },
              planId: { type: 'string' },
              deviceId: { type: 'string' },
              locationId: { type: 'string', nullable: true },
              position: {
                type: 'object',
                properties: {
                  page: { type: 'number' },
                  x: { type: 'number' },
                  y: { type: 'number' },
                  scale: { type: 'number' },
                },
              },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
          400: {
            description: 'Invalid request body',
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
          404: {
            description: 'Stamp not found',
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
          409: {
            description: 'Optimistic lock failure - stamp has been modified',
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: StampIdParams; Body: UpdateStampBody }>,
      reply: FastifyReply,
    ) => {
      try {
        const { stampId } = request.params;

        // Validate body
        const bodyResult = updateStampSchema.safeParse(request.body);
        if (!bodyResult.success) {
          return reply.code(400).send({
            error: 'Invalid request body',
            details: bodyResult.error.issues,
          });
        }

        const input = bodyResult.data;

        // Check if at least one field is provided
        if (input.position === undefined && input.locationId === undefined) {
          return reply.code(400).send({
            error: 'At least one field (position or locationId) must be provided',
          });
        }

        // Get database and service
        const { db } = await getDatabase();
        const stampService = createStampService(db);

        // Update stamp (transactional with revision and optimistic locking)
        const stamp = await stampService.update(stampId, {
          position: input.position,
          locationId: input.locationId,
          updatedAt: input.updatedAt ? new Date(input.updatedAt) : undefined,
        });

        if (!stamp) {
          return reply.code(404).send({
            error: 'Stamp not found',
          });
        }

        fastify.log.info({ stampId }, 'Stamp updated with revision');

        return reply.send(stamp);
      } catch (error) {
        if (error instanceof ServiceError) {
          const statusCode = mapServiceErrorToHttpCode(error);
          return reply.code(statusCode).send({ error: error.message });
        }

        fastify.log.error({ error }, 'Failed to update stamp');
        throw error;
      }
    },
  );

  /**
   * DELETE /plans/:planId/stamps/:stampId - Delete a stamp
   */
  fastify.delete<{ Params: StampIdParams }>(
    '/plans/:planId/stamps/:stampId',
    {
      schema: {
        description: 'Delete a stamp (transactional with revision tracking for undo)',
        tags: ['stamps'],
        params: {
          type: 'object',
          required: ['planId', 'stampId'],
          properties: {
            planId: { type: 'string', description: 'Plan ID' },
            stampId: { type: 'string', description: 'Stamp ID' },
          },
        },
        response: {
          204: {
            description: 'Stamp deleted successfully',
            type: 'null',
          },
          404: {
            description: 'Stamp not found',
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: StampIdParams }>, reply: FastifyReply) => {
      try {
        const { stampId } = request.params;

        // Get database and service
        const { db } = await getDatabase();
        const stampService = createStampService(db);

        // Delete stamp (transactional with revision)
        const deleted = await stampService.delete(stampId);

        if (!deleted) {
          return reply.code(404).send({
            error: 'Stamp not found',
          });
        }

        fastify.log.info({ stampId }, 'Stamp deleted with revision');

        return reply.code(204).send();
      } catch (error) {
        if (error instanceof ServiceError) {
          const statusCode = mapServiceErrorToHttpCode(error);
          return reply.code(statusCode).send({ error: error.message });
        }

        fastify.log.error({ error }, 'Failed to delete stamp');
        throw error;
      }
    },
  );
}
