/**
 * Plan Routes Tests
 * Integration tests for plan upload, retrieval, and deletion endpoints
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, afterEach } from 'vitest';
import { type FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import multipart from '@fastify/multipart';
import * as schema from '../db/schema.js';
import { planRoutes } from './plans.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(__dirname, '../../drizzle');

// Mock the database client module
let testDb: ReturnType<typeof drizzle>;
let testSqlite: Database.Database;

// Create a mock for getDatabase
vi.mock('../db/client.js', () => ({
  getDatabase: vi.fn(async () => ({ db: testDb, sqlite: testSqlite })),
}));

// Test data directory
const TEST_DATA_DIR = resolve(__dirname, '../../test-data');
const TEST_UPLOADS_DIR = resolve(TEST_DATA_DIR, 'uploads');

describe('Plan Routes', () => {
  let server: FastifyInstance;
  let testProjectId: string;

  beforeAll(async () => {
    // Create in-memory database for all tests
    testSqlite = new Database(':memory:');
    testSqlite.pragma('foreign_keys = ON');

    testDb = drizzle(testSqlite, { schema });
    migrate(testDb, { migrationsFolder });

    // Create test data directories
    await mkdir(TEST_UPLOADS_DIR, { recursive: true });
  });

  beforeEach(async () => {
    // Clear all data before each test
    testDb.delete(schema.plans).run();
    testDb.delete(schema.projects).run();

    // Create a test project
    const projects = testDb
      .insert(schema.projects)
      .values({
        id: 'test-project-1',
        name: 'Test Project',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()
      .all();
    testProjectId = projects[0]!.id;

    // Create minimal Fastify instance for testing
    server = Fastify({ logger: false });
    await server.register(multipart, {
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
      },
    });
    await server.register(planRoutes);
    await server.ready();
  });

  afterEach(async () => {
    if (server) {
      await server.close();
    }
  });

  afterAll(async () => {
    testSqlite.close();
    // Clean up test data directory
    await rm(TEST_DATA_DIR, { recursive: true, force: true });
  });

  /**
   * Helper function to create a test PDF with specified number of pages
   */
  async function createTestPdf(pageCount: number = 1): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    for (let i = 1; i <= pageCount; i++) {
      const page = pdfDoc.addPage([612, 792]); // Letter size
      page.drawText(`Test Page ${i}`, {
        x: 50,
        y: 750,
        size: 20,
        font,
      });
    }

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  /**
   * Helper function to create a FormData-like payload for file upload
   */
  function createFormData(filename: string, buffer: Buffer) {
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    const CRLF = '\r\n';

    // Build multipart payload with proper encoding
    const parts = [
      `------${boundary}${CRLF}`,
      `Content-Disposition: form-data; name="file"; filename="${filename}"${CRLF}`,
      `Content-Type: application/pdf${CRLF}`,
      CRLF,
    ];

    // Concatenate header and buffer
    const header = Buffer.from(parts.join(''));
    const footer = Buffer.from(`${CRLF}------${boundary}--${CRLF}`);
    const payload = Buffer.concat([header, buffer, footer]);

    return {
      payload,
      headers: {
        'content-type': `multipart/form-data; boundary=----${boundary}`,
      },
    };
  }

  describe('POST /projects/:projectId/plans', () => {
    it('should upload a single-page PDF successfully', async () => {
      const pdfBuffer = await createTestPdf(1);
      const formData = createFormData('test-plan.pdf', pdfBuffer);

      const response = await server.inject({
        method: 'POST',
        url: `/projects/${testProjectId}/plans`,
        payload: formData.payload,
        headers: formData.headers,
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        projectId: testProjectId,
        name: 'test-plan.pdf',
        pageNumber: 1,
        pageCount: 1,
      });
      expect(body.id).toBeDefined();
      expect(body.fileHash).toBeDefined();
    });

    it('should upload a multi-page PDF successfully', async () => {
      const pdfBuffer = await createTestPdf(5);
      const formData = createFormData('multi-page.pdf', pdfBuffer);

      const response = await server.inject({
        method: 'POST',
        url: `/projects/${testProjectId}/plans`,
        payload: formData.payload,
        headers: formData.headers,
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        projectId: testProjectId,
        name: 'multi-page.pdf',
        pageNumber: 1,
        pageCount: 5,
      });
    });

    it('should upload multiple PDFs to the same project with auto-incrementing pageNumber', async () => {
      // Upload first PDF
      const pdf1 = await createTestPdf(1);
      const formData1 = createFormData('plan1.pdf', pdf1);

      const response1 = await server.inject({
        method: 'POST',
        url: `/projects/${testProjectId}/plans`,
        payload: formData1.payload,
        headers: formData1.headers,
      });

      expect(response1.statusCode).toBe(201);
      const body1 = JSON.parse(response1.body);
      expect(body1.pageNumber).toBe(1);

      // Upload second PDF
      const pdf2 = await createTestPdf(3);
      const formData2 = createFormData('plan2.pdf', pdf2);

      const response2 = await server.inject({
        method: 'POST',
        url: `/projects/${testProjectId}/plans`,
        payload: formData2.payload,
        headers: formData2.headers,
      });

      expect(response2.statusCode).toBe(201);
      const body2 = JSON.parse(response2.body);
      expect(body2.pageNumber).toBe(2);

      // Upload third PDF
      const pdf3 = await createTestPdf(2);
      const formData3 = createFormData('plan3.pdf', pdf3);

      const response3 = await server.inject({
        method: 'POST',
        url: `/projects/${testProjectId}/plans`,
        payload: formData3.payload,
        headers: formData3.headers,
      });

      expect(response3.statusCode).toBe(201);
      const body3 = JSON.parse(response3.body);
      expect(body3.pageNumber).toBe(3);

      // Verify all plans are in database
      const plans = testDb.select().from(schema.plans).all();
      expect(plans).toHaveLength(3);
      expect(plans.map(p => p.pageNumber).sort()).toEqual([1, 2, 3]);
    });

    it('should reject duplicate file uploads', async () => {
      const pdfBuffer = await createTestPdf(1);
      const formData = createFormData('duplicate.pdf', pdfBuffer);

      // Upload first time
      const response1 = await server.inject({
        method: 'POST',
        url: `/projects/${testProjectId}/plans`,
        payload: formData.payload,
        headers: formData.headers,
      });

      expect(response1.statusCode).toBe(201);

      // Try to upload same file again
      const response2 = await server.inject({
        method: 'POST',
        url: `/projects/${testProjectId}/plans`,
        payload: formData.payload,
        headers: formData.headers,
      });

      expect(response2.statusCode).toBe(409);
      const body = JSON.parse(response2.body);
      expect(body.error).toContain('identical content');
      expect(body.existingPlanId).toBeDefined();
    });

    it('should reject non-PDF files', async () => {
      const textBuffer = Buffer.from('This is not a PDF');
      const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
      const CRLF = '\r\n';
      const parts = [
        `------${boundary}${CRLF}`,
        `Content-Disposition: form-data; name="file"; filename="not-a-pdf.txt"${CRLF}`,
        `Content-Type: text/plain${CRLF}`,
        CRLF,
      ];
      const header = Buffer.from(parts.join(''));
      const footer = Buffer.from(`${CRLF}------${boundary}--${CRLF}`);
      const payload = Buffer.concat([header, textBuffer, footer]);

      const response = await server.inject({
        method: 'POST',
        url: `/projects/${testProjectId}/plans`,
        payload,
        headers: {
          'content-type': `multipart/form-data; boundary=----${boundary}`,
        },
      });

      expect(response.statusCode).toBe(415);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Unsupported file type');
    });

    it('should reject requests without multipart data', async () => {
      const response = await server.inject({
        method: 'POST',
        url: `/projects/${testProjectId}/plans`,
        payload: { name: 'test' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('multipart/form-data');
    });
  });

  describe('GET /projects/:projectId/plans/:planId', () => {
    it('should retrieve plan details', async () => {
      // Create a plan directly in database
      const plans = testDb
        .insert(schema.plans)
        .values({
          id: 'test-plan-1',
          projectId: testProjectId,
          name: 'Test Plan',
          pageNumber: 1,
          pageCount: 3,
          filePath: '/test/path.pdf',
          fileSize: 1024,
          fileHash: 'abc123',
          width: 612,
          height: 792,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning()
        .all();
      const plan = plans[0];

      const response = await server.inject({
        method: 'GET',
        url: `/projects/${testProjectId}/plans/${plan!.id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        id: plan!.id,
        projectId: testProjectId,
        name: 'Test Plan',
        pageNumber: 1,
        pageCount: 3,
      });
      // Should not expose internal filePath
      expect(body.filePath).toBeUndefined();
    });

    it('should return 404 for non-existent plan', async () => {
      const response = await server.inject({
        method: 'GET',
        url: `/projects/${testProjectId}/plans/non-existent`,
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 when plan belongs to different project', async () => {
      // Create another project
      const otherProjects = testDb
        .insert(schema.projects)
        .values({
          id: 'other-project',
          name: 'Other Project',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning()
        .all();
      const otherProject = otherProjects[0];

      // Create plan in other project
      const plansInOtherProject = testDb
        .insert(schema.plans)
        .values({
          id: 'other-plan',
          projectId: otherProject!.id,
          name: 'Other Plan',
          pageNumber: 1,
          pageCount: 1,
          filePath: '/test/other.pdf',
          fileSize: 1024,
          fileHash: 'xyz789',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning()
        .all();
      const plan = plansInOtherProject[0];

      const response = await server.inject({
        method: 'GET',
        url: `/projects/${testProjectId}/plans/${plan!.id}`,
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('DELETE /projects/:projectId/plans/:planId', () => {
    it('should delete a plan', async () => {
      // Create test PDF file
      const pdfBuffer = await createTestPdf(1);
      const testFilePath = resolve(TEST_UPLOADS_DIR, 'to-delete.pdf');
      await writeFile(testFilePath, pdfBuffer);

      // Create plan in database
      const plansToDelete = testDb
        .insert(schema.plans)
        .values({
          id: 'plan-to-delete',
          projectId: testProjectId,
          name: 'To Delete',
          pageNumber: 1,
          pageCount: 1,
          filePath: testFilePath,
          fileSize: pdfBuffer.length,
          fileHash: 'delete123',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning()
        .all();
      const plan = plansToDelete[0];

      const response = await server.inject({
        method: 'DELETE',
        url: `/projects/${testProjectId}/plans/${plan!.id}`,
      });

      expect(response.statusCode).toBe(204);

      // Verify plan is deleted from database
      const plans = testDb.select().from(schema.plans).all();
      expect(plans.filter(p => p.id === plan!.id)).toHaveLength(0);
    });

    it('should return 404 when deleting non-existent plan', async () => {
      const response = await server.inject({
        method: 'DELETE',
        url: `/projects/${testProjectId}/plans/non-existent`,
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 when deleting plan from wrong project', async () => {
      // Create another project
      const otherProjects2 = testDb
        .insert(schema.projects)
        .values({
          id: 'other-project-2',
          name: 'Other Project',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning()
        .all();
      const otherProject = otherProjects2[0];

      // Create plan in other project
      const plansInOtherProject2 = testDb
        .insert(schema.plans)
        .values({
          id: 'other-plan-2',
          projectId: otherProject!.id,
          name: 'Other Plan',
          pageNumber: 1,
          pageCount: 1,
          filePath: '/test/other2.pdf',
          fileSize: 1024,
          fileHash: 'xyz999',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning()
        .all();
      const plan = plansInOtherProject2[0];

      const response = await server.inject({
        method: 'DELETE',
        url: `/projects/${testProjectId}/plans/${plan!.id}`,
      });

      expect(response.statusCode).toBe(404);

      // Verify plan still exists
      const plans = testDb.select().from(schema.plans).all();
      expect(plans.filter(p => p.id === plan!.id)).toHaveLength(1);
    });
  });
});
