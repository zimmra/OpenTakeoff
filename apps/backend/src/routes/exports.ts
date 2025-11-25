/**
 * Export Routes
 * Endpoints for exporting project data in various formats
 */

import { type FastifyInstance, type FastifyPluginOptions, type FastifyRequest, type FastifyReply } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { getDatabase } from '../db/client.js';
import { createExportService } from '../services/data/exportService.js';
import {
  formatAsCSV,
  formatAsJSON,
  formatAsPDF,
  getMimeType,
  getContentDisposition,
} from '../services/export/formatters.js';
import {
  ensureExportDirectory,
  getExportPath,
  calculateExpirationDate,
  getFileSize,
} from '../utils/exportStorage.js';
import { ServiceError, ServiceErrorCode } from '../services/data/types.js';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import * as schema from '../db/schema.js';

/**
 * Request body schema
 */
const exportRequestSchema = z.object({
  format: z.enum(['csv', 'json', 'pdf']),
  includeLocations: z.boolean().default(false),
});

type ExportRequestBody = z.infer<typeof exportRequestSchema>;

interface ExportParams {
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
    default:
      return 500;
  }
}

/**
 * Register export routes
 */
export async function exportRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  await Promise.resolve();
  /**
   * POST /projects/:projectId/exports - Generate and download export
   */
  fastify.post<{ Params: ExportParams; Body: ExportRequestBody }>(
    '/projects/:projectId/exports',
    {
      config: {
        rateLimit: {
          max: 10, // 10 exports per minute per IP
          timeWindow: '1 minute',
        },
      },
      schema: {
        description: 'Generate and download project export in specified format',
        tags: ['exports'],
        params: {
          type: 'object',
          required: ['projectId'],
          properties: {
            projectId: { type: 'string', description: 'Project ID' },
          },
        },
        body: {
          type: 'object',
          required: ['format'],
          properties: {
            format: {
              type: 'string',
              enum: ['csv', 'json', 'pdf'],
              description: 'Export format',
            },
            includeLocations: {
              type: 'boolean',
              default: false,
              description: 'Include per-location breakdowns',
            },
          },
        },
        response: {
          200: {
            description: 'Export file (stream)',
            type: 'string',
            format: 'binary',
          },
          400: {
            description: 'Invalid request',
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
          429: {
            description: 'Rate limit exceeded',
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: ExportParams; Body: ExportRequestBody }>,
      reply: FastifyReply,
    ) => {
      try {
        const { projectId } = request.params;

        // Validate request body
        const bodyResult = exportRequestSchema.safeParse(request.body);
        if (!bodyResult.success) {
          return reply.code(400).send({
            error: 'Invalid request body',
            details: bodyResult.error.issues,
          });
        }

        const { format, includeLocations } = bodyResult.data;

        // Get database and services
        const { db } = await getDatabase();
        const exportService = createExportService(db);

        // Get export data
        const exportData = await exportService.getExportData(projectId, includeLocations);

        // Ensure export directory exists
        await ensureExportDirectory();

        // Generate export ID and file path
        const exportId = randomUUID();
        const filePath = getExportPath(projectId, exportId, format);

        // Format data based on format
        let exportStream;

        switch (format) {
          case 'csv':
            exportStream = formatAsCSV(exportData);
            break;
          case 'json':
            exportStream = formatAsJSON(exportData);
            break;
          case 'pdf':
            exportStream = await formatAsPDF(exportData);
            break;
        }

        // Write to file and stream to response simultaneously
        const fileStream = createWriteStream(filePath);

        // Set response headers
        reply.header('Content-Type', getMimeType(format));
        reply.header('Content-Disposition', getContentDisposition(exportData.projectName, format));

        // Pipe stream to both file and response
        const responsePromise = reply.send(exportStream);

        // Also save to file
        const savePromise = pipeline(exportStream, fileStream);

        // Wait for both to complete
        await Promise.all([responsePromise, savePromise]);

        // Get file size
        const fileSize = await getFileSize(filePath);

        // Log export in database
        const expiresAt = calculateExpirationDate();

        await db.insert(schema.exports).values({
          id: exportId,
          projectId,
          format,
          filePath,
          fileSize,
          includeLocations,
          expiresAt,
          createdAt: new Date(),
        });

        fastify.log.info(
          {
            projectId,
            exportId,
            format,
            fileSize,
            includeLocations,
          },
          'Export generated',
        );
      } catch (error) {
        if (error instanceof ServiceError) {
          const statusCode = mapServiceErrorToHttpCode(error);
          return reply.code(statusCode).send({ error: error.message });
        }

        fastify.log.error({ error }, 'Failed to generate export');
        return reply.code(500).send({ error: 'Failed to generate export' });
      }
    },
  );
}
