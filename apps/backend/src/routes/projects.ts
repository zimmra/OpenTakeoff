/**
 * Project Routes
 * RESTful CRUD endpoints for project management
 */

import { type FastifyInstance, type FastifyPluginOptions, type FastifyRequest, type FastifyReply } from 'fastify';
import { z } from 'zod';
import { getDatabase } from '../db/client.js';
import {
  createProjectService,
  createPlanService,
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

// Project create schema
const createProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
});

// Project update schema
const updateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional().nullable(),
});

/**
 * Type definitions for route parameters
 */
interface ProjectIdParams {
  id: string;
}

interface ListProjectsQuery {
  limit?: number;
  cursor?: string;
  [key: string]: unknown;
}

interface CreateProjectBody {
  name: string;
  description?: string;
}

interface UpdateProjectBody {
  name?: string;
  description?: string | null;
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
 * Register project routes
 */
export async function projectRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  await Promise.resolve();
  /**
   * GET /projects - List projects with pagination
   */
  fastify.get<{ Querystring: ListProjectsQuery }>(
    '/projects',
    {
      schema: {
        description: 'List all projects with pagination support',
        tags: ['projects'],
        querystring: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              minimum: 1,
              maximum: 100,
              description: 'Maximum number of projects to return (default: 50)',
            },
            cursor: {
              type: 'string',
              description: 'Cursor for pagination (ID of last item from previous page)',
            },
          },
        },
        response: {
          200: {
            description: 'List of projects',
            headers: {
              Link: {
                type: 'string',
                description: 'RFC5988 Link header for pagination (next page)',
              },
            },
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    description: { type: 'string', nullable: true },
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
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: ListProjectsQuery }>, reply: FastifyReply) => {
      try {
        // Validate query parameters
        const queryResult = paginationQuerySchema.safeParse(request.query);
        if (!queryResult.success) {
          return reply.code(400).send({
            error: 'Invalid query parameters',
            details: queryResult.error.issues,
          });
        }

        const params: PaginationParams = queryResult.data;

        // Get database and service
        const { db } = await getDatabase();
        const projectService = createProjectService(db);

        // List projects
        const result = await projectService.list(params);

        // Add Link header for pagination if there's a next page
        const linkHeader = buildLinkHeader(
          '/projects',
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

        fastify.log.error({ error }, 'Failed to list projects');
        throw error;
      }
    },
  );

  /**
   * POST /projects - Create a new project
   */
  fastify.post<{ Body: CreateProjectBody }>(
    '/projects',
    {
      schema: {
        description: 'Create a new project',
        tags: ['projects'],
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            description: { type: 'string', maxLength: 1000 },
          },
        },
        response: {
          201: {
            description: 'Project created successfully',
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string', nullable: true },
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
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreateProjectBody }>, reply: FastifyReply) => {
      try {
        // Validate body
        const bodyResult = createProjectSchema.safeParse(request.body);
        if (!bodyResult.success) {
          return reply.code(400).send({
            error: 'Invalid request body',
            details: bodyResult.error.issues,
          });
        }

        const input = bodyResult.data;

        // Get database and service
        const { db } = await getDatabase();
        const projectService = createProjectService(db);

        // Create project
        const project = await projectService.create({
          name: input.name,
          description: input.description,
        });

        fastify.log.info({ projectId: project.id, name: project.name }, 'Project created');

        return reply.code(201).send(project);
      } catch (error) {
        if (error instanceof ServiceError) {
          const statusCode = mapServiceErrorToHttpCode(error);
          return reply.code(statusCode).send({ error: error.message });
        }

        fastify.log.error({ error }, 'Failed to create project');
        throw error;
      }
    },
  );

  /**
   * GET /projects/:id - Get a project by ID
   */
  fastify.get<{ Params: ProjectIdParams }>(
    '/projects/:id',
    {
      schema: {
        description: 'Get a project by ID',
        tags: ['projects'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'Project ID' },
          },
        },
        response: {
          200: {
            description: 'Project found',
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string', nullable: true },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
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
    async (request: FastifyRequest<{ Params: ProjectIdParams }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;

        // Get database and service
        const { db } = await getDatabase();
        const projectService = createProjectService(db);

        // Get project
        const project = await projectService.getById(id);

        if (!project) {
          return reply.code(404).send({
            error: 'Project not found',
          });
        }

        return reply.send(project);
      } catch (error) {
        if (error instanceof ServiceError) {
          const statusCode = mapServiceErrorToHttpCode(error);
          return reply.code(statusCode).send({ error: error.message });
        }

        fastify.log.error({ error }, 'Failed to get project');
        throw error;
      }
    },
  );

  /**
   * PATCH /projects/:id - Update a project
   */
  fastify.patch<{ Params: ProjectIdParams; Body: UpdateProjectBody }>(
    '/projects/:id',
    {
      schema: {
        description: 'Update a project',
        tags: ['projects'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'Project ID' },
          },
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            description: { type: 'string', maxLength: 1000, nullable: true },
          },
        },
        response: {
          200: {
            description: 'Project updated successfully',
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string', nullable: true },
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
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: ProjectIdParams; Body: UpdateProjectBody }>,
      reply: FastifyReply,
    ) => {
      try {
        const { id } = request.params;

        // Validate body
        const bodyResult = updateProjectSchema.safeParse(request.body);
        if (!bodyResult.success) {
          return reply.code(400).send({
            error: 'Invalid request body',
            details: bodyResult.error.issues,
          });
        }

        const input = bodyResult.data;

        // Check if at least one field is provided
        if (input.name === undefined && input.description === undefined) {
          return reply.code(400).send({
            error: 'At least one field (name or description) must be provided',
          });
        }

        // Get database and service
        const { db } = await getDatabase();
        const projectService = createProjectService(db);

        // Update project
        const project = await projectService.update(id, {
          name: input.name,
          description: input.description,
        });

        if (!project) {
          return reply.code(404).send({
            error: 'Project not found',
          });
        }

        fastify.log.info({ projectId: id }, 'Project updated');

        return reply.send(project);
      } catch (error) {
        if (error instanceof ServiceError) {
          const statusCode = mapServiceErrorToHttpCode(error);
          return reply.code(statusCode).send({ error: error.message });
        }

        fastify.log.error({ error }, 'Failed to update project');
        throw error;
      }
    },
  );

  /**
   * DELETE /projects/:id - Delete a project
   */
  fastify.delete<{ Params: ProjectIdParams }>(
    '/projects/:id',
    {
      schema: {
        description: 'Delete a project (cascades to all related plans, devices, etc.)',
        tags: ['projects'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'Project ID' },
          },
        },
        response: {
          204: {
            description: 'Project deleted successfully',
            type: 'null',
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
    async (request: FastifyRequest<{ Params: ProjectIdParams }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;

        // Get database and service
        const { db } = await getDatabase();
        const projectService = createProjectService(db);

        // Delete project
        const deleted = await projectService.delete(id);

        if (!deleted) {
          return reply.code(404).send({
            error: 'Project not found',
          });
        }

        fastify.log.info({ projectId: id }, 'Project deleted');

        return reply.code(204).send();
      } catch (error) {
        if (error instanceof ServiceError) {
          const statusCode = mapServiceErrorToHttpCode(error);
          return reply.code(statusCode).send({ error: error.message });
        }

        fastify.log.error({ error }, 'Failed to delete project');
        throw error;
      }
    },
  );

  /**
   * GET /projects/:id/plans - List plans for a project
   */
  fastify.get<{ Params: ProjectIdParams; Querystring: ListProjectsQuery }>(
    '/projects/:id/plans',
    {
      schema: {
        description: 'List all plans for a specific project with pagination',
        tags: ['projects', 'plans'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'Project ID' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              minimum: 1,
              maximum: 100,
              description: 'Maximum number of plans to return (default: 50)',
            },
            cursor: {
              type: 'string',
              description: 'Cursor for pagination (ID of last item from previous page)',
            },
          },
        },
        response: {
          200: {
            description: 'List of plan metadata for the project',
            headers: {
              Link: {
                type: 'string',
                description: 'RFC5988 Link header for pagination (next page)',
              },
            },
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
                    pageNumber: { type: 'number' },
                    pageCount: { type: 'number' },
                    fileSize: { type: 'number' },
                    width: { type: 'number', nullable: true },
                    height: { type: 'number', nullable: true },
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
      request: FastifyRequest<{ Params: ProjectIdParams; Querystring: ListProjectsQuery }>,
      reply: FastifyReply,
    ) => {
      try {
        const { id } = request.params;

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
        const planService = createPlanService(db);

        // Check if project exists
        const project = await projectService.getById(id);
        if (!project) {
          return reply.code(404).send({
            error: 'Project not found',
          });
        }

        // List plans for project
        const result = await planService.listByProject(id, params);

        // Add Link header for pagination if there's a next page
        const linkHeader = buildLinkHeader(
          `/projects/${id}/plans`,
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

        fastify.log.error({ error }, 'Failed to list plans for project');
        throw error;
      }
    },
  );
}
