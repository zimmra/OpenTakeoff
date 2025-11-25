/**
 * Plans Routes
 * Handles PDF plan upload, metadata extraction, and deletion
 */

import { type FastifyInstance, type FastifyPluginOptions, type FastifyRequest, type FastifyReply } from 'fastify';
import { PDFDocument } from 'pdf-lib';
import { pipeline } from 'node:stream/promises';
import { createWriteStream, createReadStream } from 'node:fs';
import { unlink, readFile, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { getDatabase } from '../db/client.js';
import * as schema from '../db/schema.js';
import { eq } from 'drizzle-orm';
import {
  getPdfPath,
  ensureProjectDir,
  computeFileHash,
} from '../services/storage/pdfStorage.js';

/**
 * Plan upload request params
 */
interface UploadPlanParams {
  projectId: string;
}

/**
 * Plan ID params
 */
interface PlanIdParams {
  projectId: string;
  planId: string;
}

/**
 * Plan deletion request params
 */
interface DeletePlanParams {
  projectId: string;
  planId: string;
}

/**
 * Register plan routes
 */
export async function planRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  await Promise.resolve();
  /**
   * POST /projects/:projectId/plans - Upload PDF plan
   *
   * Handles PDF upload with:
   * - MIME type validation
   * - File streaming to disk
   * - SHA-256 deduplication
   * - Metadata extraction (page count, dimensions)
   * - Database persistence
   */
  fastify.post<{ Params: UploadPlanParams }>(
    '/projects/:projectId/plans',
    {
      schema: {
        description: 'Upload a PDF plan for a project',
        tags: ['plans'],
        params: {
          type: 'object',
          required: ['projectId'],
          properties: {
            projectId: { type: 'string', description: 'Project ID' },
          },
        },
        consumes: ['multipart/form-data'],
        response: {
          201: {
            description: 'Plan uploaded successfully',
            type: 'object',
            properties: {
              id: { type: 'string' },
              projectId: { type: 'string' },
              name: { type: 'string' },
              pageNumber: { type: 'number' },
              pageCount: { type: 'number' },
              width: { type: 'number', nullable: true },
              height: { type: 'number', nullable: true },
              fileSize: { type: 'number' },
              fileHash: { type: 'string' },
              filePath: { type: 'string' },
            },
          },
          400: {
            description: 'Bad request - invalid file or missing data',
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
          409: {
            description: 'Conflict - duplicate file',
            type: 'object',
            properties: {
              error: { type: 'string' },
              existingPlanId: { type: 'string' },
            },
          },
          413: {
            description: 'Payload too large - file exceeds size limit',
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
          415: {
            description: 'Unsupported media type - not a PDF',
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
          422: {
            description: 'Unprocessable entity - corrupted PDF',
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: UploadPlanParams }>, reply: FastifyReply) => {
      const { projectId } = request.params;

      // Check if request is multipart
      if (!request.isMultipart()) {
        return reply.code(400).send({
          error: 'Request must be multipart/form-data',
        });
      }

      try {
        // Get uploaded file
        const data = await request.file();

        if (!data) {
          return reply.code(400).send({
            error: 'No file uploaded',
          });
        }

        // Validate MIME type
        if (data.mimetype !== 'application/pdf') {
          return reply.code(415).send({
            error: `Unsupported file type: ${data.mimetype}. Only PDF files are allowed.`,
          });
        }

        // Generate plan ID and file path
        const planId = randomUUID();
        await ensureProjectDir(projectId);
        const filePath = getPdfPath(projectId, planId);

        // Stream file to disk
        await pipeline(data.file, createWriteStream(filePath));

        // Check if file was truncated due to size limit
        if (data.file.truncated) {
          await unlink(filePath);
          return reply.code(413).send({
            error: 'File exceeds maximum size limit',
          });
        }

        // Compute file hash for deduplication
        const fileHash = await computeFileHash(filePath);

        // Check for duplicate files in this project
        const { db } = await getDatabase();
        const existingPlans = await db
          .select()
          .from(schema.plans)
          .where(eq(schema.plans.fileHash, fileHash))
          .limit(1);

        if (existingPlans.length > 0) {
          // Clean up duplicate file
          await unlink(filePath);
          return reply.code(409).send({
            error: 'A plan with identical content already exists in this project',
            existingPlanId: existingPlans[0]?.id,
          });
        }

        // Extract PDF metadata
        const pdfBytes = await readFile(filePath);
        let pdfDoc: PDFDocument;
        let pageCount: number;
        let width: number | null = null;
        let height: number | null = null;

        try {
          pdfDoc = await PDFDocument.load(pdfBytes);
          pageCount = pdfDoc.getPageCount();

          // Get dimensions of first page
          if (pageCount > 0) {
            const firstPage = pdfDoc.getPage(0);
            const size = firstPage.getSize();
            width = Math.round(size.width);
            height = Math.round(size.height);
          }
        } catch (error) {
          // Clean up invalid PDF
          await unlink(filePath);
          fastify.log.error({ error }, 'Failed to parse PDF');
          return reply.code(422).send({
            error: 'Failed to parse PDF. The file may be corrupted or invalid.',
          });
        }

        // Get file size
        const fileSize = pdfBytes.length;

        // Insert plan into database
        const [plan] = await db
          .insert(schema.plans)
          .values({
            id: planId,
            projectId,
            name: data.filename || 'Untitled Plan',
            pageNumber: 1, // Default page number (can be updated later)
            pageCount,
            filePath,
            fileSize,
            fileHash,
            width,
            height,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        fastify.log.info(
          {
            planId,
            projectId,
            filename: data.filename,
            pageCount,
            fileSize,
          },
          'Plan uploaded successfully',
        );

        return reply.code(201).send(plan);
      } catch (error) {
        if (error instanceof fastify.multipartErrors.RequestFileTooLargeError) {
          return reply.code(413).send({
            error: 'File exceeds maximum size limit',
          });
        }

        fastify.log.error({ error }, 'Failed to upload plan');
        throw error;
      }
    },
  );

  /**
   * GET /projects/:projectId/plans/:planId - Get plan details
   */
  fastify.get<{ Params: PlanIdParams }>(
    '/projects/:projectId/plans/:planId',
    {
      schema: {
        description: 'Get plan details',
        tags: ['plans'],
        params: {
          type: 'object',
          required: ['projectId', 'planId'],
          properties: {
            projectId: { type: 'string', description: 'Project ID' },
            planId: { type: 'string', description: 'Plan ID' },
          },
        },
        response: {
          200: {
            description: 'Plan details',
            type: 'object',
            properties: {
              id: { type: 'string' },
              projectId: { type: 'string' },
              name: { type: 'string' },
              pageNumber: { type: 'number' },
              pageCount: { type: 'number' },
              width: { type: 'number', nullable: true },
              height: { type: 'number', nullable: true },
              fileSize: { type: 'number' },
              fileHash: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
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
      const { projectId, planId } = request.params;
      const { db } = await getDatabase();

      const plans = await db
        .select()
        .from(schema.plans)
        .where(eq(schema.plans.id, planId))
        .limit(1);

      if (plans.length === 0) {
        return reply.code(404).send({ error: 'Plan not found' });
      }

      const plan = plans[0];
      if (!plan) {
        return reply.code(404).send({ error: 'Plan not found' });
      }

      if (plan.projectId !== projectId) {
        return reply.code(404).send({ error: 'Plan not found in this project' });
      }

      // Don't return internal fields like filePath in API
      return {
        ...plan,
        filePath: undefined,
      };
    }
  );

  /**
   * GET /projects/:projectId/plans/:planId/file - Get plan PDF file
   */
  fastify.get<{ Params: PlanIdParams }>(
    '/projects/:projectId/plans/:planId/file',
    {
      schema: {
        description: 'Get plan PDF file content',
        tags: ['plans'],
        params: {
          type: 'object',
          required: ['projectId', 'planId'],
          properties: {
            projectId: { type: 'string', description: 'Project ID' },
            planId: { type: 'string', description: 'Plan ID' },
          },
        },
        response: {
          200: {
            description: 'PDF file content',
            type: 'string',
            format: 'binary',
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
      const { projectId, planId } = request.params;
      const { db } = await getDatabase();

      const plans = await db
        .select()
        .from(schema.plans)
        .where(eq(schema.plans.id, planId))
        .limit(1);

      if (plans.length === 0) {
        return reply.code(404).send({ error: 'Plan not found' });
      }

      const plan = plans[0];
      if (!plan) {
        return reply.code(404).send({ error: 'Plan not found' });
      }

      if (plan.projectId !== projectId) {
        return reply.code(404).send({ error: 'Plan not found in this project' });
      }

      try {
        // Check if file exists
        await stat(plan.filePath);
        
        // Stream the file
        const stream = createReadStream(plan.filePath);
        reply.type('application/pdf');
        return reply.send(stream);
      } catch (error) {
        fastify.log.error({ error, filePath: plan.filePath }, 'Failed to read plan file');
        return reply.code(404).send({ error: 'Plan file not found' });
      }
    }
  );

  /**
   * DELETE /projects/:projectId/plans/:planId - Delete plan
   *
   * Removes plan file from disk and database record
   */
  fastify.delete<{ Params: DeletePlanParams }>(
    '/projects/:projectId/plans/:planId',
    {
      schema: {
        description: 'Delete a plan from a project',
        tags: ['plans'],
        params: {
          type: 'object',
          required: ['projectId', 'planId'],
          properties: {
            projectId: { type: 'string', description: 'Project ID' },
            planId: { type: 'string', description: 'Plan ID' },
          },
        },
        response: {
          204: {
            description: 'Plan deleted successfully',
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
    async (request: FastifyRequest<{ Params: DeletePlanParams }>, reply: FastifyReply) => {
      const { projectId, planId } = request.params;

      const { db } = await getDatabase();

      // Find the plan
      const plans = await db
        .select()
        .from(schema.plans)
        .where(eq(schema.plans.id, planId))
        .limit(1);

      if (plans.length === 0) {
        return reply.code(404).send({
          error: 'Plan not found',
        });
      }

      const plan = plans[0];

      if (!plan) {
        return reply.code(404).send({
          error: 'Plan not found',
        });
      }

      // Verify plan belongs to the project
      if (plan.projectId !== projectId) {
        return reply.code(404).send({
          error: 'Plan not found in this project',
        });
      }

      // Delete file from disk
      try {
        await unlink(plan.filePath);
      } catch (error) {
        // Log error but continue with database deletion
        fastify.log.warn({ error, filePath: plan.filePath }, 'Failed to delete plan file');
      }

      // Delete from database
      await db.delete(schema.plans).where(eq(schema.plans.id, planId));

      fastify.log.info({ planId, projectId }, 'Plan deleted successfully');

      return reply.code(204).send();
    },
  );
}
