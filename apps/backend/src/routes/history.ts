/**
 * History Routes
 * RESTful endpoints for undo/redo functionality
 */

import { type FastifyInstance, type FastifyPluginOptions, type FastifyRequest, type FastifyReply } from 'fastify';
import { z } from 'zod';
import { getDatabase } from '../db/client.js';
import {
  createHistoryService,
  createProjectService,
  ServiceError,
  ServiceErrorCode,
} from '../services/data/index.js';

/**
 * Zod Schemas for Validation
 */

// Project ID param schema
const projectIdParamSchema = z.object({
  projectId: z.string().uuid(),
});

/**
 * Type definitions for route parameters
 */
interface ProjectIdParams {
  projectId: string;
}

/**
 * Map ServiceError to HTTP status code
 */
function mapServiceErrorToHttpCode(error: ServiceError): number {
  switch (error.code) {
    case ServiceErrorCode.NOT_FOUND:
      return 404;
    case ServiceErrorCode.INVALID_INPUT:
      return 400;
    case ServiceErrorCode.DATABASE_ERROR:
    default:
      return 500;
  }
}

/**
 * Register history routes
 */
export async function historyRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  await Promise.resolve();
  /**
   * GET /projects/:projectId/history - Get history entries
   */
  fastify.get<{ Params: ProjectIdParams }>(
    '/projects/:projectId/history',
    {
      schema: {
        description: 'Get combined history of stamps and locations for a project (max 100 entries)',
        tags: ['history'],
        params: {
          type: 'object',
          required: ['projectId'],
          properties: {
            projectId: { type: 'string', format: 'uuid', description: 'Project ID' },
          },
        },
        response: {
          200: {
            description: 'History entries',
            type: 'object',
            properties: {
              entries: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    entityId: { type: 'string' },
                    entityType: { type: 'string', enum: ['stamp', 'location'] },
                    type: { type: 'string', enum: ['create', 'update', 'delete'] },
                    snapshot: { type: 'object', nullable: true },
                    createdAt: { type: 'string', format: 'date-time' },
                  },
                },
              },
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
        const { projectId } = request.params;

        // Validate params
        const paramsResult = projectIdParamSchema.safeParse(request.params);
        if (!paramsResult.success) {
          return reply.code(400).send({
            error: 'Invalid project ID',
            details: paramsResult.error.issues,
          });
        }

        // Get database and services
        const { db } = await getDatabase();
        const projectService = createProjectService(db);
        const historyService = createHistoryService(db);

        // Check if project exists
        const project = await projectService.getById(projectId);
        if (!project) {
          return reply.code(404).send({
            error: 'Project not found',
          });
        }

        // Get history
        const entries = await historyService.getHistory(projectId);

        return reply.send({ entries });
      } catch (error) {
        if (error instanceof ServiceError) {
          const statusCode = mapServiceErrorToHttpCode(error);
          return reply.code(statusCode).send({ error: error.message });
        }

        fastify.log.error({ error }, 'Failed to get history');
        throw error;
      }
    },
  );

  /**
   * POST /projects/:projectId/history/undo - Undo last action
   */
  fastify.post<{ Params: ProjectIdParams }>(
    '/projects/:projectId/history/undo',
    {
      schema: {
        description: 'Undo the most recent action in the project history',
        tags: ['history'],
        params: {
          type: 'object',
          required: ['projectId'],
          properties: {
            projectId: { type: 'string', format: 'uuid', description: 'Project ID' },
          },
        },
        response: {
          200: {
            description: 'Action undone successfully',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              entityType: { type: 'string', enum: ['stamp', 'location'] },
              entityId: { type: 'string' },
              action: { type: 'string', enum: ['undo'] },
              restoredState: { type: 'object', nullable: true },
            },
          },
          404: {
            description: 'Project not found or no history to undo',
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
        const { projectId } = request.params;

        // Validate params
        const paramsResult = projectIdParamSchema.safeParse(request.params);
        if (!paramsResult.success) {
          return reply.code(400).send({
            error: 'Invalid project ID',
            details: paramsResult.error.issues,
          });
        }

        // Get database and services
        const { db } = await getDatabase();
        const projectService = createProjectService(db);
        const historyService = createHistoryService(db);

        // Check if project exists
        const project = await projectService.getById(projectId);
        if (!project) {
          return reply.code(404).send({
            error: 'Project not found',
          });
        }

        // Perform undo
        const result = await historyService.undo(projectId);

        if (!result) {
          return reply.code(404).send({
            error: 'No history to undo',
          });
        }

        fastify.log.info(
          { projectId, entityType: result.entityType, entityId: result.entityId },
          'Action undone',
        );

        return reply.send(result);
      } catch (error) {
        if (error instanceof ServiceError) {
          const statusCode = mapServiceErrorToHttpCode(error);
          return reply.code(statusCode).send({ error: error.message });
        }

        fastify.log.error({ error }, 'Failed to undo action');
        throw error;
      }
    },
  );

  /**
   * POST /projects/:projectId/history/prune - Prune old history entries
   */
  fastify.post<{ Params: ProjectIdParams }>(
    '/projects/:projectId/history/prune',
    {
      schema: {
        description: 'Remove history entries beyond the 100-entry limit',
        tags: ['history'],
        params: {
          type: 'object',
          required: ['projectId'],
          properties: {
            projectId: { type: 'string', format: 'uuid', description: 'Project ID' },
          },
        },
        response: {
          204: {
            description: 'History pruned successfully',
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
        const { projectId } = request.params;

        // Validate params
        const paramsResult = projectIdParamSchema.safeParse(request.params);
        if (!paramsResult.success) {
          return reply.code(400).send({
            error: 'Invalid project ID',
            details: paramsResult.error.issues,
          });
        }

        // Get database and services
        const { db } = await getDatabase();
        const projectService = createProjectService(db);
        const historyService = createHistoryService(db);

        // Check if project exists
        const project = await projectService.getById(projectId);
        if (!project) {
          return reply.code(404).send({
            error: 'Project not found',
          });
        }

        // Prune history
        await historyService.pruneHistory(projectId);

        fastify.log.info({ projectId }, 'History pruned');

        return reply.code(204).send();
      } catch (error) {
        if (error instanceof ServiceError) {
          const statusCode = mapServiceErrorToHttpCode(error);
          return reply.code(statusCode).send({ error: error.message });
        }

        fastify.log.error({ error }, 'Failed to prune history');
        throw error;
      }
    },
  );
}
