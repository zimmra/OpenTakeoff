/**
 * Location Routes
 * RESTful CRUD endpoints for location management (rectangles and polygons)
 */

import { type FastifyInstance, type FastifyPluginOptions, type FastifyRequest, type FastifyReply } from 'fastify';
import { z } from 'zod';
import { getDatabase } from '../db/client.js';
import { createLocationService, ServiceError, ServiceErrorCode } from '../services/data/index.js';
import {
  validatePolygonVertices,
  validateRectangleBounds,
  autoClosePolygon,
} from '../utils/geometry.js';

/**
 * Zod Schemas for Validation
 */

// Vertex schema
const vertexSchema = z.object({
  x: z.number(),
  y: z.number(),
});

// Rectangle bounds schema
const rectangleBoundsSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
});

// Create rectangle location schema
const createRectangleSchema = z.object({
  name: z.string().min(1).max(255),
  bounds: rectangleBoundsSchema,
  color: z.string().max(50).optional(),
});

// Create polygon location schema
const createPolygonSchema = z.object({
  name: z.string().min(1).max(255),
  vertices: z.array(vertexSchema).min(3),
  color: z.string().max(50).optional(),
});

// Update location schema
const updateLocationSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  bounds: rectangleBoundsSchema.nullable().optional(),
  vertices: z.array(vertexSchema).min(3).optional(),
  color: z.string().max(50).nullable().optional(),
});

/**
 * Type definitions for route parameters
 */
interface PlanIdParams {
  planId: string;
}

interface LocationIdParams {
  planId: string;
  locationId: string;
}

interface CreateRectangleBody {
  name: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  color?: string;
}

interface CreatePolygonBody {
  name: string;
  vertices: { x: number; y: number }[];
  color?: string;
}

interface UpdateLocationBody {
  name?: string;
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  vertices?: { x: number; y: number }[];
  color?: string | null;
}

/**
 * Map ServiceError to HTTP status code
 */
function mapServiceErrorToHttpCode(error: ServiceError): number {
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
 * Register location routes
 */
export async function locationRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  await Promise.resolve();
  /**
   * GET /plans/:planId/locations - List locations for a plan
   */
  fastify.get<{ Params: PlanIdParams }>(
    '/plans/:planId/locations',
    {
      schema: {
        description: 'List all locations (rectangles/polygons) for a plan',
        tags: ['locations'],
        params: {
          type: 'object',
          required: ['planId'],
          properties: {
            planId: { type: 'string', description: 'Plan ID' },
          },
        },
        // Response schema removed for full serialization
        // response: { 200: { ... } },
      },
    },
    async (request: FastifyRequest<{ Params: PlanIdParams }>, reply: FastifyReply) => {
      try {
        const { planId } = request.params;

        // Get database and service
        const { db } = await getDatabase();
        const locationService = createLocationService(db);

        // List locations
        const locations = await locationService.listByPlan(planId);

        return reply.send(locations);
      } catch (error) {
        if (error instanceof ServiceError) {
          const statusCode = mapServiceErrorToHttpCode(error);
          return reply.code(statusCode).send({ error: error.message });
        }

        fastify.log.error({ error }, 'Failed to list locations');
        throw error;
      }
    },
  );

  /**
   * GET /plans/:planId/locations/:locationId - Get a location by ID
   */
  fastify.get<{ Params: LocationIdParams }>(
    '/plans/:planId/locations/:locationId',
    {
      schema: {
        description: 'Get a location by ID',
        tags: ['locations'],
        params: {
          type: 'object',
          required: ['planId', 'locationId'],
          properties: {
            planId: { type: 'string', description: 'Plan ID' },
            locationId: { type: 'string', description: 'Location ID' },
          },
        },
        // Response schema removed for full serialization
        // response: { 200: { ... }, 404: { ... } },
      },
    },
    async (request: FastifyRequest<{ Params: LocationIdParams }>, reply: FastifyReply) => {
      try {
        const { locationId } = request.params;

        // Get database and service
        const { db } = await getDatabase();
        const locationService = createLocationService(db);

        // Get location
        const location = await locationService.getById(locationId);

        if (!location) {
          return reply.code(404).send({
            error: 'Location not found',
          });
        }

        return reply.send(location);
      } catch (error) {
        if (error instanceof ServiceError) {
          const statusCode = mapServiceErrorToHttpCode(error);
          return reply.code(statusCode).send({ error: error.message });
        }

        fastify.log.error({ error }, 'Failed to get location');
        throw error;
      }
    },
  );

  /**
   * POST /plans/:planId/locations/rectangle - Create a rectangle location
   */
  fastify.post<{ Params: PlanIdParams; Body: CreateRectangleBody }>(
    '/plans/:planId/locations/rectangle',
    {
      schema: {
        description: 'Create a rectangle location',
        tags: ['locations'],
        params: {
          type: 'object',
          required: ['planId'],
          properties: {
            planId: { type: 'string', description: 'Plan ID' },
          },
        },
        body: {
          type: 'object',
          required: ['name', 'bounds'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            bounds: {
              type: 'object',
              required: ['x', 'y', 'width', 'height'],
              properties: {
                x: { type: 'number' },
                y: { type: 'number' },
                width: { type: 'number' },
                height: { type: 'number' },
              },
            },
            color: { type: 'string', maxLength: 50 },
          },
        },
        // Response schemas removed to allow full serialization
        // Fastify with response schema only serializes defined properties
        // response: {
        //   201: { ... },
        // },
      },
    },
    async (
      request: FastifyRequest<{ Params: PlanIdParams; Body: CreateRectangleBody }>,
      reply: FastifyReply,
    ) => {
      try {
        const { planId } = request.params;

        // Validate body
        const bodyResult = createRectangleSchema.safeParse(request.body);
        if (!bodyResult.success) {
          return reply.code(400).send({
            error: 'Invalid request body',
            details: bodyResult.error.issues,
          });
        }

        const input = bodyResult.data;

        // Validate rectangle bounds
        const validation = validateRectangleBounds(input.bounds);
        if (!validation.valid) {
          return reply.code(400).send({
            error: validation.error,
          });
        }

        // Get database and service
        const { db } = await getDatabase();
        const locationService = createLocationService(db);

        // Create rectangle location
        const location = await locationService.createRectangle({
          planId,
          name: input.name,
          bounds: input.bounds,
          ...(input.color && { color: input.color }),
        });

        fastify.log.info({ locationId: location.id, planId }, 'Rectangle location created');

        return reply.code(201).send(location);
      } catch (error) {
        if (error instanceof ServiceError) {
          const statusCode = mapServiceErrorToHttpCode(error);
          return reply.code(statusCode).send({ error: error.message });
        }

        fastify.log.error({ error }, 'Failed to create rectangle location');
        throw error;
      }
    },
  );

  /**
   * POST /plans/:planId/locations/polygon - Create a polygon location
   */
  fastify.post<{ Params: PlanIdParams; Body: CreatePolygonBody }>(
    '/plans/:planId/locations/polygon',
    {
      schema: {
        description: 'Create a polygon location',
        tags: ['locations'],
        params: {
          type: 'object',
          required: ['planId'],
          properties: {
            planId: { type: 'string', description: 'Plan ID' },
          },
        },
        body: {
          type: 'object',
          required: ['name', 'vertices'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            vertices: {
              type: 'array',
              minItems: 3,
              items: {
                type: 'object',
                required: ['x', 'y'],
                properties: {
                  x: { type: 'number' },
                  y: { type: 'number' },
                },
              },
            },
            color: { type: 'string', maxLength: 50 },
          },
        },
        // Response schemas removed to allow full serialization
        // response: {
        //   201: { ... },
        // },
      },
    },
    async (
      request: FastifyRequest<{ Params: PlanIdParams; Body: CreatePolygonBody }>,
      reply: FastifyReply,
    ) => {
      try {
        const { planId } = request.params;

        // Validate body
        const bodyResult = createPolygonSchema.safeParse(request.body);
        if (!bodyResult.success) {
          return reply.code(400).send({
            error: 'Invalid request body',
            details: bodyResult.error.issues,
          });
        }

        const input = bodyResult.data;

        // Auto-close polygon if needed
        const cleanedVertices = autoClosePolygon(input.vertices);

        // Validate polygon vertices
        const validation = validatePolygonVertices(cleanedVertices);
        if (!validation.valid) {
          return reply.code(400).send({
            error: validation.error,
          });
        }

        // Get database and service
        const { db } = await getDatabase();
        const locationService = createLocationService(db);

        // Create polygon location
        const location = await locationService.createPolygon({
          planId,
          name: input.name,
          vertices: cleanedVertices,
          ...(input.color && { color: input.color }),
        });

        fastify.log.info({ locationId: location.id, planId }, 'Polygon location created');

        return reply.code(201).send(location);
      } catch (error) {
        if (error instanceof ServiceError) {
          const statusCode = mapServiceErrorToHttpCode(error);
          return reply.code(statusCode).send({ error: error.message });
        }

        fastify.log.error({ error }, 'Failed to create polygon location');
        throw error;
      }
    },
  );

  /**
   * PATCH /plans/:planId/locations/:locationId - Update a location
   */
  fastify.patch<{ Params: LocationIdParams; Body: UpdateLocationBody }>(
    '/plans/:planId/locations/:locationId',
    {
      schema: {
        description: 'Update a location',
        tags: ['locations'],
        params: {
          type: 'object',
          required: ['planId', 'locationId'],
          properties: {
            planId: { type: 'string', description: 'Plan ID' },
            locationId: { type: 'string', description: 'Location ID' },
          },
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            bounds: {
              type: 'object',
              nullable: true,
              properties: {
                x: { type: 'number' },
                y: { type: 'number' },
                width: { type: 'number' },
                height: { type: 'number' },
              },
            },
            vertices: {
              type: 'array',
              minItems: 3,
              items: {
                type: 'object',
                properties: {
                  x: { type: 'number' },
                  y: { type: 'number' },
                },
              },
            },
            color: { type: 'string', maxLength: 50, nullable: true },
          },
        },
        // Response schema removed for full serialization
        // response: { 200: { ... }, 400: { ... }, 404: { ... } },
      },
    },
    async (
      request: FastifyRequest<{ Params: LocationIdParams; Body: UpdateLocationBody }>,
      reply: FastifyReply,
    ) => {
      try {
        const { locationId } = request.params;

        // Validate body
        const bodyResult = updateLocationSchema.safeParse(request.body);
        if (!bodyResult.success) {
          return reply.code(400).send({
            error: 'Invalid request body',
            details: bodyResult.error.issues,
          });
        }

        const input = bodyResult.data;

        // Validate bounds if provided
        if (input.bounds !== undefined && input.bounds !== null) {
          const validation = validateRectangleBounds(input.bounds);
          if (!validation.valid) {
            return reply.code(400).send({
              error: validation.error,
            });
          }
        }

        // Validate and clean vertices if provided
        let cleanedVertices = input.vertices;
        if (input.vertices !== undefined) {
          cleanedVertices = autoClosePolygon(input.vertices);
          const validation = validatePolygonVertices(cleanedVertices);
          if (!validation.valid) {
            return reply.code(400).send({
              error: validation.error,
            });
          }
        }

        // Get database and service
        const { db } = await getDatabase();
        const locationService = createLocationService(db);

        // Update location
        const location = await locationService.update(locationId, {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.bounds !== undefined && { bounds: input.bounds }),
          ...(cleanedVertices !== undefined && { vertices: cleanedVertices }),
          ...(input.color !== undefined && { color: input.color }),
        });

        if (!location) {
          return reply.code(404).send({
            error: 'Location not found',
          });
        }

        fastify.log.info({ locationId }, 'Location updated');

        return reply.send(location);
      } catch (error) {
        if (error instanceof ServiceError) {
          const statusCode = mapServiceErrorToHttpCode(error);
          return reply.code(statusCode).send({ error: error.message });
        }

        fastify.log.error({ error }, 'Failed to update location');
        throw error;
      }
    },
  );

  /**
   * DELETE /plans/:planId/locations/:locationId - Delete a location
   */
  fastify.delete<{ Params: LocationIdParams }>(
    '/plans/:planId/locations/:locationId',
    {
      schema: {
        description: 'Delete a location (cascades to vertices and revisions)',
        tags: ['locations'],
        params: {
          type: 'object',
          required: ['planId', 'locationId'],
          properties: {
            planId: { type: 'string', description: 'Plan ID' },
            locationId: { type: 'string', description: 'Location ID' },
          },
        },
        // Response schema removed for full serialization
        // response: { 204: { ... }, 404: { ... } },
      },
    },
    async (request: FastifyRequest<{ Params: LocationIdParams }>, reply: FastifyReply) => {
      try {
        const { locationId } = request.params;

        // Get database and service
        const { db } = await getDatabase();
        const locationService = createLocationService(db);

        // Delete location
        const deleted = await locationService.delete(locationId);

        if (!deleted) {
          return reply.code(404).send({
            error: 'Location not found',
          });
        }

        fastify.log.info({ locationId }, 'Location deleted');

        return reply.code(204).send();
      } catch (error) {
        if (error instanceof ServiceError) {
          const statusCode = mapServiceErrorToHttpCode(error);
          return reply.code(statusCode).send({ error: error.message });
        }

        fastify.log.error({ error }, 'Failed to delete location');
        throw error;
      }
    },
  );
}
