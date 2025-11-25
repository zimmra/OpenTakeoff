/**
 * Project State Routes
 * RESTful endpoints for session persistence and autosave
 */

import { type FastifyInstance, type FastifyPluginOptions, type FastifyRequest, type FastifyReply } from 'fastify';
import { z } from 'zod';

/**
 * Schema version for drift detection
 * Update this when making breaking schema changes
 */
export const CURRENT_SCHEMA_VERSION = '1.0.0';

/**
 * Zod Schemas for Validation
 */

// Unsynced change schema
const unsyncedChangeSchema = z.object({
  id: z.string(),
  entityType: z.enum(['stamp', 'location']),
  changeType: z.enum(['create', 'update', 'delete']),
  entityId: z.string(),
  timestamp: z.number(),
  data: z.any().nullable(),
});

// Autosave payload schema
const autosavePayloadSchema = z.object({
  projectId: z.string(),
  planId: z.string().nullable(),
  schemaVersion: z.string(),
  timestamp: z.number(),
  unsyncedChanges: z.array(unsyncedChangeSchema),
});

/**
 * Type definitions
 */
interface ProjectIdParams {
  id: string;
}

interface AutosavePayload {
  projectId: string;
  planId: string | null;
  schemaVersion: string;
  timestamp: number;
  unsyncedChanges: {
    id: string;
    entityType: 'stamp' | 'location';
    changeType: 'create' | 'update' | 'delete';
    entityId: string;
    timestamp: number;
    data: unknown;
  }[];
}

/**
 * Register project state routes
 */
export async function projectStateRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  await Promise.resolve();
  /**
   * GET /projects/:id/state/version - Get schema version
   */
  fastify.get<{ Params: ProjectIdParams }>(
    '/projects/:id/state/version',
    {
      schema: {
        description: 'Get current schema version for version drift detection',
        tags: ['projects', 'state'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'Project ID' },
          },
        },
        response: {
          200: {
            description: 'Schema version information',
            type: 'object',
            properties: {
              version: { type: 'string' },
              timestamp: { type: 'number' },
            },
          },
        },
      },
    },
    async (_request: FastifyRequest<{ Params: ProjectIdParams }>, reply: FastifyReply) => {
      return reply.send({
        version: CURRENT_SCHEMA_VERSION,
        timestamp: Date.now(),
      });
    },
  );

  /**
   * PUT /projects/:id/state - Update project session state (autosave)
   */
  fastify.put<{ Params: ProjectIdParams; Body: AutosavePayload }>(
    '/projects/:id/state',
    {
      schema: {
        description: 'Update project session state with pending changes (autosave)',
        tags: ['projects', 'state'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'Project ID' },
          },
        },
        body: {
          type: 'object',
          required: ['projectId', 'schemaVersion', 'timestamp', 'unsyncedChanges'],
          properties: {
            projectId: { type: 'string' },
            planId: { type: 'string', nullable: true },
            schemaVersion: { type: 'string' },
            timestamp: { type: 'number' },
            unsyncedChanges: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  entityType: { type: 'string', enum: ['stamp', 'location'] },
                  changeType: { type: 'string', enum: ['create', 'update', 'delete'] },
                  entityId: { type: 'string' },
                  timestamp: { type: 'number' },
                  data: { type: 'object', nullable: true },
                },
              },
            },
          },
        },
        response: {
          200: {
            description: 'State updated successfully',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              projectId: { type: 'string' },
              syncedAt: { type: 'number' },
              schemaVersion: { type: 'string' },
              conflictingChanges: {
                type: 'array',
                items: { type: 'object' },
              },
            },
          },
          400: {
            description: 'Invalid request body or version mismatch',
            type: 'object',
            properties: {
              error: { type: 'string' },
              code: { type: 'string' },
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
      request: FastifyRequest<{ Params: ProjectIdParams; Body: AutosavePayload }>,
      reply: FastifyReply,
    ) => {
      try {
        const { id } = request.params;

        // Validate body
        const bodyResult = autosavePayloadSchema.safeParse(request.body);
        if (!bodyResult.success) {
          return reply.code(400).send({
            error: 'Invalid request body',
            details: bodyResult.error.issues,
          });
        }

        const payload = bodyResult.data;

        // Verify project ID matches
        if (payload.projectId !== id) {
          return reply.code(400).send({
            error: 'Project ID mismatch',
            code: 'PROJECT_ID_MISMATCH',
          });
        }

        // Check for version mismatch
        if (payload.schemaVersion !== CURRENT_SCHEMA_VERSION) {
          return reply.code(400).send({
            error: `Schema version mismatch. Client: ${payload.schemaVersion}, Server: ${CURRENT_SCHEMA_VERSION}`,
            code: 'VERSION_MISMATCH',
          });
        }

        // TODO: Process unsynced changes and persist to database
        // For now, we'll acknowledge receipt
        fastify.log.info(
          {
            projectId: id,
            changeCount: payload.unsyncedChanges.length,
            timestamp: payload.timestamp,
          },
          'Received autosave state',
        );

        return reply.send({
          success: true,
          projectId: id,
          syncedAt: Date.now(),
          schemaVersion: CURRENT_SCHEMA_VERSION,
          conflictingChanges: [], // Future: detect and report conflicts
        });
      } catch (error) {
        fastify.log.error({ error }, 'Failed to update project state');
        throw error;
      }
    },
  );
}
