/**
 * Device Routes
 * RESTful CRUD endpoints for device management within projects
 */

import { type FastifyInstance, type FastifyPluginOptions, type FastifyRequest, type FastifyReply } from 'fastify';
import { z } from 'zod';
import { getDatabase } from '../db/client.js';
import {
  createDeviceService,
  createProjectService,
  ServiceError,
  ServiceErrorCode,
  type PaginationParams,
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

// Device create/update schema
const hexColorRegex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

const createDeviceSchema = z.object({
  name: z.string().min(1).max(60, 'Device name must be 60 characters or less'),
  description: z.string().max(500).optional(),
  color: z.string().regex(hexColorRegex, 'Color must be a valid hex code (e.g., #FF0000)').optional(),
  iconKey: z.string().max(1000).optional(),
});

const updateDeviceSchema = z.object({
  name: z.string().min(1).max(60, 'Device name must be 60 characters or less').optional(),
  description: z.string().max(500).optional().nullable(),
  color: z.string().regex(hexColorRegex, 'Color must be a valid hex code (e.g., #FF0000)').optional().nullable(),
  iconKey: z.string().max(1000).optional().nullable(),
});

/**
 * Type definitions for route parameters
 */
interface ProjectIdParams {
  projectId: string;
}

interface DeviceIdParams {
  projectId: string;
  deviceId: string;
}

interface ListDevicesQuery {
  limit?: number;
  cursor?: string;
  [key: string]: unknown;
}

interface CreateDeviceBody {
  name: string;
  description?: string;
  color?: string;
  iconKey?: string;
}

interface UpdateDeviceBody {
  name?: string;
  description?: string | null;
  color?: string | null;
  iconKey?: string | null;
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
 * Register device routes
 */
export async function deviceRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  await Promise.resolve();
  /**
   * GET /projects/:projectId/devices - List devices for a project
   */
  fastify.get<{ Params: ProjectIdParams; Querystring: ListDevicesQuery }>(
    '/projects/:projectId/devices',
    {
      schema: {
        description: 'List all devices for a specific project with pagination',
        tags: ['devices'],
        params: {
          type: 'object',
          required: ['projectId'],
          properties: {
            projectId: { type: 'string', description: 'Project ID' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              minimum: 1,
              maximum: 100,
              description: 'Maximum number of devices to return (default: 50)',
            },
            cursor: {
              type: 'string',
              description: 'Cursor for pagination (ID of last item from previous page)',
            },
          },
        },
        response: {
          200: {
            description: 'List of devices for the project',
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    projectId: { type: 'string' },
                    name: { type: 'string' },
                    description: { type: 'string', nullable: true },
                    color: { type: 'string', nullable: true },
                    iconKey: { type: 'string', nullable: true },
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
            description: 'Project not found',
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: ProjectIdParams; Querystring: ListDevicesQuery }>,
      reply: FastifyReply,
    ) => {
      try {
        const { projectId } = request.params;

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
        const projectService = createProjectService(db);
        const deviceService = createDeviceService(db);

        // Check if project exists
        const project = await projectService.getById(projectId);
        if (!project) {
          return reply.code(404).send({
            error: 'Project not found',
          });
        }

        // List devices for project
        const result = await deviceService.listByProject(projectId, params);

        // Add Link header for pagination if there's a next page
        const linkHeader = buildLinkHeader(
          `/projects/${projectId}/devices`,
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

        fastify.log.error({ error }, 'Failed to list devices');
        throw error;
      }
    },
  );

  /**
   * POST /projects/:projectId/devices - Create a new device
   */
  fastify.post<{ Params: ProjectIdParams; Body: CreateDeviceBody }>(
    '/projects/:projectId/devices',
    {
      schema: {
        description: 'Create a new device in a project',
        tags: ['devices'],
        params: {
          type: 'object',
          required: ['projectId'],
          properties: {
            projectId: { type: 'string', description: 'Project ID' },
          },
        },
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 60 },
            description: { type: 'string', maxLength: 500 },
            color: { type: 'string', pattern: '^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$' },
            iconKey: { type: 'string', maxLength: 1000 },
          },
        },
        response: {
          201: {
            description: 'Device created successfully',
            type: 'object',
            properties: {
              id: { type: 'string' },
              projectId: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string', nullable: true },
              color: { type: 'string', nullable: true },
              iconKey: { type: 'string', nullable: true },
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
            description: 'Project not found',
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
          409: {
            description: 'Device with same name already exists',
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: ProjectIdParams; Body: CreateDeviceBody }>,
      reply: FastifyReply,
    ) => {
      try {
        const { projectId } = request.params;

        // Validate body
        const bodyResult = createDeviceSchema.safeParse(request.body);
        if (!bodyResult.success) {
          return reply.code(400).send({
            error: 'Invalid request body',
            details: bodyResult.error.issues,
          });
        }

        const input = bodyResult.data;

        // Get database and services
        const { db } = await getDatabase();
        const projectService = createProjectService(db);
        const deviceService = createDeviceService(db);

        // Check if project exists
        const project = await projectService.getById(projectId);
        if (!project) {
          return reply.code(404).send({
            error: 'Project not found',
          });
        }

        // Create device
        const device = await deviceService.create({
          projectId,
          name: input.name,
          description: input.description,
          color: input.color,
          iconKey: input.iconKey,
        });

        fastify.log.info({ deviceId: device.id, projectId, name: device.name }, 'Device created');

        return reply.code(201).send(device);
      } catch (error) {
        if (error instanceof ServiceError) {
          const statusCode = mapServiceErrorToHttpCode(error);
          return reply.code(statusCode).send({ error: error.message });
        }

        fastify.log.error({ error }, 'Failed to create device');
        throw error;
      }
    },
  );

  /**
   * GET /projects/:projectId/devices/:deviceId - Get a device by ID
   */
  fastify.get<{ Params: DeviceIdParams }>(
    '/projects/:projectId/devices/:deviceId',
    {
      schema: {
        description: 'Get a device by ID',
        tags: ['devices'],
        params: {
          type: 'object',
          required: ['projectId', 'deviceId'],
          properties: {
            projectId: { type: 'string', description: 'Project ID' },
            deviceId: { type: 'string', description: 'Device ID' },
          },
        },
        response: {
          200: {
            description: 'Device found',
            type: 'object',
            properties: {
              id: { type: 'string' },
              projectId: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string', nullable: true },
              color: { type: 'string', nullable: true },
              iconKey: { type: 'string', nullable: true },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
          404: {
            description: 'Device not found',
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: DeviceIdParams }>, reply: FastifyReply) => {
      try {
        const { deviceId } = request.params;

        // Get database and service
        const { db } = await getDatabase();
        const deviceService = createDeviceService(db);

        // Get device
        const device = await deviceService.getById(deviceId);

        if (!device) {
          return reply.code(404).send({
            error: 'Device not found',
          });
        }

        return reply.send(device);
      } catch (error) {
        if (error instanceof ServiceError) {
          const statusCode = mapServiceErrorToHttpCode(error);
          return reply.code(statusCode).send({ error: error.message });
        }

        fastify.log.error({ error }, 'Failed to get device');
        throw error;
      }
    },
  );

  /**
   * PATCH /projects/:projectId/devices/:deviceId - Update a device
   */
  fastify.patch<{ Params: DeviceIdParams; Body: UpdateDeviceBody }>(
    '/projects/:projectId/devices/:deviceId',
    {
      schema: {
        description: 'Update a device',
        tags: ['devices'],
        params: {
          type: 'object',
          required: ['projectId', 'deviceId'],
          properties: {
            projectId: { type: 'string', description: 'Project ID' },
            deviceId: { type: 'string', description: 'Device ID' },
          },
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 60 },
            description: { type: 'string', maxLength: 500, nullable: true },
            color: { type: 'string', pattern: '^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$', nullable: true },
            iconKey: { type: 'string', maxLength: 1000, nullable: true },
          },
        },
        response: {
          200: {
            description: 'Device updated successfully',
            type: 'object',
            properties: {
              id: { type: 'string' },
              projectId: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string', nullable: true },
              color: { type: 'string', nullable: true },
              iconKey: { type: 'string', nullable: true },
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
            description: 'Device not found',
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
          409: {
            description: 'Device with same name already exists',
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: DeviceIdParams; Body: UpdateDeviceBody }>,
      reply: FastifyReply,
    ) => {
      try {
        const { deviceId } = request.params;

        // Validate body
        const bodyResult = updateDeviceSchema.safeParse(request.body);
        if (!bodyResult.success) {
          return reply.code(400).send({
            error: 'Invalid request body',
            details: bodyResult.error.issues,
          });
        }

        const input = bodyResult.data;

        // Check if at least one field is provided
        if (
          input.name === undefined &&
          input.description === undefined &&
          input.color === undefined &&
          input.iconKey === undefined
        ) {
          return reply.code(400).send({
            error: 'At least one field must be provided',
          });
        }

        // Get database and service
        const { db } = await getDatabase();
        const deviceService = createDeviceService(db);

        // Update device
        const device = await deviceService.update(deviceId, {
          name: input.name,
          description: input.description,
          color: input.color,
          iconKey: input.iconKey,
        });

        if (!device) {
          return reply.code(404).send({
            error: 'Device not found',
          });
        }

        fastify.log.info({ deviceId }, 'Device updated');

        return reply.send(device);
      } catch (error) {
        if (error instanceof ServiceError) {
          const statusCode = mapServiceErrorToHttpCode(error);
          return reply.code(statusCode).send({ error: error.message });
        }

        fastify.log.error({ error }, 'Failed to update device');
        throw error;
      }
    },
  );

  /**
   * DELETE /projects/:projectId/devices/:deviceId - Delete a device
   */
  fastify.delete<{ Params: DeviceIdParams }>(
    '/projects/:projectId/devices/:deviceId',
    {
      schema: {
        description: 'Delete a device (cascades to all related stamps)',
        tags: ['devices'],
        params: {
          type: 'object',
          required: ['projectId', 'deviceId'],
          properties: {
            projectId: { type: 'string', description: 'Project ID' },
            deviceId: { type: 'string', description: 'Device ID' },
          },
        },
        response: {
          204: {
            description: 'Device deleted successfully',
            type: 'null',
          },
          404: {
            description: 'Device not found',
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: DeviceIdParams }>, reply: FastifyReply) => {
      try {
        const { deviceId } = request.params;

        // Get database and service
        const { db } = await getDatabase();
        const deviceService = createDeviceService(db);

        // Delete device
        const deleted = await deviceService.delete(deviceId);

        if (!deleted) {
          return reply.code(404).send({
            error: 'Device not found',
          });
        }

        fastify.log.info({ deviceId }, 'Device deleted');

        return reply.code(204).send();
      } catch (error) {
        if (error instanceof ServiceError) {
          const statusCode = mapServiceErrorToHttpCode(error);
          return reply.code(statusCode).send({ error: error.message });
        }

        fastify.log.error({ error }, 'Failed to delete device');
        throw error;
      }
    },
  );
}
