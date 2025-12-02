/**
 * Project Routes Tests
 * Integration tests for project CRUD endpoints
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { type FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from '../db/schema.js';
import { projectRoutes } from './projects.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(__dirname, '../../drizzle');

// Mock the database client module
let testDb: ReturnType<typeof drizzle>;
let testSqlite: Database.Database;

// Create a mock for getDatabase
vi.mock('../db/client.js', () => ({
  getDatabase: vi.fn(async () => ({ db: testDb, sqlite: testSqlite })),
}));

describe('Project Routes', () => {
  let server: FastifyInstance;

  beforeAll(() => {
    // Create in-memory database for all tests
    testSqlite = new Database(':memory:');
    testSqlite.pragma('foreign_keys = ON');

    testDb = drizzle(testSqlite, { schema });
    migrate(testDb, { migrationsFolder });
  });

  beforeEach(async () => {
    // Clear all data before each test
    testDb.delete(schema.plans).run();
    testDb.delete(schema.projects).run();

    // Create minimal Fastify instance for testing
    server = Fastify({ logger: false });
    await server.register(projectRoutes);
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
    testSqlite.close();
  });

  describe('POST /projects', () => {
    it('should create a project with name only', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/projects',
        payload: {
          name: 'Test Project',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        name: 'Test Project',
        description: null,
      });
      expect(body.id).toBeDefined();
      expect(body.createdAt).toBeDefined();
      expect(body.updatedAt).toBeDefined();
    });

    it('should create a project with name and description', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/projects',
        payload: {
          name: 'Test Project',
          description: 'A test project',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        name: 'Test Project',
        description: 'A test project',
      });
    });

    it('should reject empty name', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/projects',
        payload: {
          name: '',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBeDefined();
    });

    it('should reject missing name', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/projects',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject name longer than 255 characters', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/projects',
        payload: {
          name: 'a'.repeat(256),
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /projects', () => {
    it('should return empty list when no projects exist', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/projects',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        items: [],
        pagination: {
          count: 0,
          hasMore: false,
          nextCursor: null,
        },
      });
    });

    it('should list all projects', async () => {
      // Create projects
      await server.inject({
        method: 'POST',
        url: '/projects',
        payload: { name: 'Project 1' },
      });

      await server.inject({
        method: 'POST',
        url: '/projects',
        payload: { name: 'Project 2' },
      });

      // List projects
      const response = await server.inject({
        method: 'GET',
        url: '/projects',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.items).toHaveLength(2);
      expect(body.pagination.count).toBe(2);
      expect(body.pagination.hasMore).toBe(false);
    });

    it('should handle pagination with limit', async () => {
      // Create 5 projects
      for (let i = 1; i <= 5; i++) {
        await server.inject({
          method: 'POST',
          url: '/projects',
          payload: { name: `Project ${i}` },
        });
      }

      // Get first page
      const response1 = await server.inject({
        method: 'GET',
        url: '/projects?limit=2',
      });

      expect(response1.statusCode).toBe(200);
      const body1 = JSON.parse(response1.body);
      expect(body1.items).toHaveLength(2);
      expect(body1.pagination.hasMore).toBe(true);
      expect(body1.pagination.nextCursor).toBeDefined();

      // Get second page
      const response2 = await server.inject({
        method: 'GET',
        url: `/projects?limit=2&cursor=${body1.pagination.nextCursor}`,
      });

      expect(response2.statusCode).toBe(200);
      const body2 = JSON.parse(response2.body);
      expect(body2.items).toHaveLength(2);
      expect(body2.pagination.hasMore).toBe(true);
    });

    it('should reject invalid limit', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/projects?limit=0',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject limit > 100', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/projects?limit=101',
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /projects/:id', () => {
    it('should get a project by ID', async () => {
      // Create project
      const createResponse = await server.inject({
        method: 'POST',
        url: '/projects',
        payload: { name: 'Test Project', description: 'Test Description' },
      });

      const created = JSON.parse(createResponse.body);

      // Get project
      const response = await server.inject({
        method: 'GET',
        url: `/projects/${created.id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        id: created.id,
        name: 'Test Project',
        description: 'Test Description',
      });
    });

    it('should return 404 for non-existent project', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/projects/non-existent-id',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Project not found');
    });
  });

  describe('PATCH /projects/:id', () => {
    it('should update project name', async () => {
      // Create project
      const createResponse = await server.inject({
        method: 'POST',
        url: '/projects',
        payload: { name: 'Original Name' },
      });

      const created = JSON.parse(createResponse.body);

      // Update project
      const response = await server.inject({
        method: 'PATCH',
        url: `/projects/${created.id}`,
        payload: { name: 'Updated Name' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.name).toBe('Updated Name');
    });

    it('should update project description', async () => {
      // Create project
      const createResponse = await server.inject({
        method: 'POST',
        url: '/projects',
        payload: { name: 'Test', description: 'Original' },
      });

      const created = JSON.parse(createResponse.body);

      // Update project
      const response = await server.inject({
        method: 'PATCH',
        url: `/projects/${created.id}`,
        payload: { description: 'Updated' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.description).toBe('Updated');
      expect(body.name).toBe('Test'); // Name unchanged
    });

    it('should set description to null', async () => {
      // Create project
      const createResponse = await server.inject({
        method: 'POST',
        url: '/projects',
        payload: { name: 'Test', description: 'Original' },
      });

      const created = JSON.parse(createResponse.body);

      // Update project
      const response = await server.inject({
        method: 'PATCH',
        url: `/projects/${created.id}`,
        payload: { description: null },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.description).toBeNull();
    });

    it('should return 404 for non-existent project', async () => {
      const response = await server.inject({
        method: 'PATCH',
        url: '/projects/non-existent-id',
        payload: { name: 'Updated' },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should reject empty update', async () => {
      // Create project
      const createResponse = await server.inject({
        method: 'POST',
        url: '/projects',
        payload: { name: 'Test' },
      });

      const created = JSON.parse(createResponse.body);

      // Try to update with no fields
      const response = await server.inject({
        method: 'PATCH',
        url: `/projects/${created.id}`,
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('At least one field');
    });

    it('should reject invalid name', async () => {
      // Create project
      const createResponse = await server.inject({
        method: 'POST',
        url: '/projects',
        payload: { name: 'Test' },
      });

      const created = JSON.parse(createResponse.body);

      // Try to update with empty name
      const response = await server.inject({
        method: 'PATCH',
        url: `/projects/${created.id}`,
        payload: { name: '' },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('DELETE /projects/:id', () => {
    it('should delete a project', async () => {
      // Create project
      const createResponse = await server.inject({
        method: 'POST',
        url: '/projects',
        payload: { name: 'To Delete' },
      });

      const created = JSON.parse(createResponse.body);

      // Delete project
      const deleteResponse = await server.inject({
        method: 'DELETE',
        url: `/projects/${created.id}`,
      });

      expect(deleteResponse.statusCode).toBe(204);
      expect(deleteResponse.body).toBe('');

      // Verify deletion
      const getResponse = await server.inject({
        method: 'GET',
        url: `/projects/${created.id}`,
      });

      expect(getResponse.statusCode).toBe(404);
    });

    it('should return 404 for non-existent project', async () => {
      const response = await server.inject({
        method: 'DELETE',
        url: '/projects/non-existent-id',
      });

      expect(response.statusCode).toBe(404);
    });

    it('should cascade delete related plans', async () => {
      // Create project
      const createResponse = await server.inject({
        method: 'POST',
        url: '/projects',
        payload: { name: 'Project with Plans' },
      });

      const created = JSON.parse(createResponse.body);

      // Insert a plan directly into the database
      testDb
        .insert(schema.plans)
        .values({
          id: 'test-plan',
          projectId: created.id,
          name: 'Test Plan',
          pageNumber: 1,
          pageCount: 1,
          filePath: '/test/path.pdf',
          fileSize: 1000,
          fileHash: 'abc123',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .run();

      // Delete project
      const deleteResponse = await server.inject({
        method: 'DELETE',
        url: `/projects/${created.id}`,
      });

      expect(deleteResponse.statusCode).toBe(204);

      // Verify plan was also deleted
      const plans = testDb.select().from(schema.plans).all();
      expect(plans).toHaveLength(0);
    });
  });

  describe('Complete CRUD Flow', () => {
    it('should handle complete project lifecycle', async () => {
      // Create
      const createResponse = await server.inject({
        method: 'POST',
        url: '/projects',
        payload: { name: 'Lifecycle Test', description: 'Initial' },
      });

      expect(createResponse.statusCode).toBe(201);
      const created = JSON.parse(createResponse.body);

      // Read
      const getResponse = await server.inject({
        method: 'GET',
        url: `/projects/${created.id}`,
      });

      expect(getResponse.statusCode).toBe(200);

      // Update
      const updateResponse = await server.inject({
        method: 'PATCH',
        url: `/projects/${created.id}`,
        payload: { description: 'Updated' },
      });

      expect(updateResponse.statusCode).toBe(200);
      const updated = JSON.parse(updateResponse.body);
      expect(updated.description).toBe('Updated');

      // List (should contain our project)
      const listResponse = await server.inject({
        method: 'GET',
        url: '/projects',
      });

      expect(listResponse.statusCode).toBe(200);
      const list = JSON.parse(listResponse.body);
      expect(list.items.some((p: any) => p.id === created.id)).toBe(true);

      // Delete
      const deleteResponse = await server.inject({
        method: 'DELETE',
        url: `/projects/${created.id}`,
      });

      expect(deleteResponse.statusCode).toBe(204);

      // Verify deletion
      const finalGetResponse = await server.inject({
        method: 'GET',
        url: `/projects/${created.id}`,
      });

      expect(finalGetResponse.statusCode).toBe(404);
    });
  });

  describe('GET /projects/:id/plans', () => {
    it('should return empty list for project with no plans', async () => {
      // Create project
      const createResponse = await server.inject({
        method: 'POST',
        url: '/projects',
        payload: { name: 'Empty Project' },
      });

      const created = JSON.parse(createResponse.body);

      // Get plans
      const response = await server.inject({
        method: 'GET',
        url: `/projects/${created.id}/plans`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        items: [],
        pagination: {
          count: 0,
          hasMore: false,
          nextCursor: null,
        },
      });
    });

    it('should list plans for a project', async () => {
      // Create project
      const createResponse = await server.inject({
        method: 'POST',
        url: '/projects',
        payload: { name: 'Project with Plans' },
      });

      const created = JSON.parse(createResponse.body);

      // Add plans directly to database
      testDb
        .insert(schema.plans)
        .values({
          id: 'plan-1',
          projectId: created.id,
          name: 'Plan 1',
          pageNumber: 1,
          pageCount: 3,
          filePath: '/test/plan1.pdf',
          fileSize: 1024000,
          fileHash: 'hash1',
          width: 800,
          height: 600,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .run();

      testDb
        .insert(schema.plans)
        .values({
          id: 'plan-2',
          projectId: created.id,
          name: 'Plan 2',
          pageNumber: 2,
          pageCount: 2,
          filePath: '/test/plan2.pdf',
          fileSize: 512000,
          fileHash: 'hash2',
          width: 1024,
          height: 768,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .run();

      // Get plans
      const response = await server.inject({
        method: 'GET',
        url: `/projects/${created.id}/plans`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.items).toHaveLength(2);
      expect(body.pagination.count).toBe(2);
      expect(body.pagination.hasMore).toBe(false);

      // Verify plan metadata (should not include filePath)
      expect(body.items[0]).toHaveProperty('id');
      expect(body.items[0]).toHaveProperty('name');
      expect(body.items[0]).toHaveProperty('fileSize');
      expect(body.items[0]).not.toHaveProperty('filePath');
      expect(body.items[0]).not.toHaveProperty('fileHash');
    });

    it('should handle pagination for project plans', async () => {
      // Create project
      const createResponse = await server.inject({
        method: 'POST',
        url: '/projects',
        payload: { name: 'Project with Many Plans' },
      });

      const created = JSON.parse(createResponse.body);

      // Add 5 plans
      for (let i = 1; i <= 5; i++) {
        testDb
          .insert(schema.plans)
          .values({
            id: `plan-${i}`,
            projectId: created.id,
            name: `Plan ${i}`,
            pageNumber: i,
            pageCount: 1,
            filePath: `/test/plan${i}.pdf`,
            fileSize: 1000 * i,
            fileHash: `hash${i}`,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .run();
      }

      // Get first page
      const page1Response = await server.inject({
        method: 'GET',
        url: `/projects/${created.id}/plans?limit=2`,
      });

      expect(page1Response.statusCode).toBe(200);
      const page1 = JSON.parse(page1Response.body);
      expect(page1.items).toHaveLength(2);
      expect(page1.pagination.hasMore).toBe(true);
      expect(page1.pagination.nextCursor).toBeDefined();

      // Get second page
      const page2Response = await server.inject({
        method: 'GET',
        url: `/projects/${created.id}/plans?limit=2&cursor=${page1.pagination.nextCursor}`,
      });

      expect(page2Response.statusCode).toBe(200);
      const page2 = JSON.parse(page2Response.body);
      expect(page2.items).toHaveLength(2);
      expect(page2.pagination.hasMore).toBe(true);

      // Verify no overlap between pages
      const page1Ids = page1.items.map((p: any) => p.id);
      const page2Ids = page2.items.map((p: any) => p.id);
      const overlap = page1Ids.filter((id: string) => page2Ids.includes(id));
      expect(overlap).toHaveLength(0);
    });

    it('should return 404 for non-existent project', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/projects/non-existent-id/plans',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Project not found');
    });

    it('should reject invalid pagination parameters', async () => {
      // Create project
      const createResponse = await server.inject({
        method: 'POST',
        url: '/projects',
        payload: { name: 'Test Project' },
      });

      const created = JSON.parse(createResponse.body);

      // Test invalid limit
      const response = await server.inject({
        method: 'GET',
        url: `/projects/${created.id}/plans?limit=0`,
      });

      expect(response.statusCode).toBe(400);
    });

    it('should only return plans for the specified project', async () => {
      // Create two projects
      const project1Response = await server.inject({
        method: 'POST',
        url: '/projects',
        payload: { name: 'Project 1' },
      });
      const project1 = JSON.parse(project1Response.body);

      const project2Response = await server.inject({
        method: 'POST',
        url: '/projects',
        payload: { name: 'Project 2' },
      });
      const project2 = JSON.parse(project2Response.body);

      // Add plans to both projects
      testDb
        .insert(schema.plans)
        .values({
          id: 'plan-p1-1',
          projectId: project1.id,
          name: 'Project 1 Plan 1',
          pageNumber: 1,
          pageCount: 1,
          filePath: '/test/p1-1.pdf',
          fileSize: 1000,
          fileHash: 'hash-p1-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .run();

      testDb
        .insert(schema.plans)
        .values({
          id: 'plan-p2-1',
          projectId: project2.id,
          name: 'Project 2 Plan 1',
          pageNumber: 1,
          pageCount: 1,
          filePath: '/test/p2-1.pdf',
          fileSize: 1000,
          fileHash: 'hash-p2-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .run();

      // Get plans for project 1
      const response = await server.inject({
        method: 'GET',
        url: `/projects/${project1.id}/plans`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.items).toHaveLength(1);
      expect(body.items[0].projectId).toBe(project1.id);
      expect(body.items[0].name).toBe('Project 1 Plan 1');
    });
  });

  describe('RFC5988 Link Headers', () => {
    describe('GET /projects with Link headers', () => {
      it('should include Link header when there are more pages', async () => {
        // Create 5 projects
        for (let i = 1; i <= 5; i++) {
          await server.inject({
            method: 'POST',
            url: '/projects',
            payload: { name: `Project ${i}` },
          });
        }

        // Get first page with limit=2
        const response = await server.inject({
          method: 'GET',
          url: '/projects?limit=2',
        });

        expect(response.statusCode).toBe(200);
        expect(response.headers.link).toBeDefined();

        const body = JSON.parse(response.body);
        const linkHeader = response.headers.link as string;

        // Verify Link header format: </projects?limit=2&cursor=xxx>; rel="next"
        expect(linkHeader).toMatch(/^<\/projects\?limit=2&cursor=[^>]+>; rel="next"$/);

        // Extract cursor from Link header
        const cursorMatch = /cursor=([^>&]+)/.exec(linkHeader);
        expect(cursorMatch).toBeTruthy();

        if (cursorMatch) {
          const cursor = cursorMatch[1];
          // Cursor should match the nextCursor from pagination
          expect(cursor).toBe(body.pagination.nextCursor);
        }
      });

      it('should not include Link header when there are no more pages', async () => {
        // Create 2 projects
        await server.inject({
          method: 'POST',
          url: '/projects',
          payload: { name: 'Project 1' },
        });

        await server.inject({
          method: 'POST',
          url: '/projects',
          payload: { name: 'Project 2' },
        });

        // Get all projects with high limit
        const response = await server.inject({
          method: 'GET',
          url: '/projects?limit=10',
        });

        expect(response.statusCode).toBe(200);
        expect(response.headers.link).toBeUndefined();

        const body = JSON.parse(response.body);
        expect(body.pagination.hasMore).toBe(false);
        expect(body.pagination.nextCursor).toBeNull();
      });

      it('should not include Link header for empty results', async () => {
        const response = await server.inject({
          method: 'GET',
          url: '/projects',
        });

        expect(response.statusCode).toBe(200);
        expect(response.headers.link).toBeUndefined();

        const body = JSON.parse(response.body);
        expect(body.items).toHaveLength(0);
        expect(body.pagination.hasMore).toBe(false);
      });

      it('should preserve query parameters in Link header', async () => {
        // Create projects
        for (let i = 1; i <= 5; i++) {
          await server.inject({
            method: 'POST',
            url: '/projects',
            payload: { name: `Project ${i}` },
          });
        }

        // Request with custom limit
        const response = await server.inject({
          method: 'GET',
          url: '/projects?limit=3',
        });

        expect(response.statusCode).toBe(200);
        const linkHeader = response.headers.link as string;

        // Verify limit is preserved in Link header
        expect(linkHeader).toContain('limit=3');
      });
    });

    describe('GET /projects/:id/plans with Link headers', () => {
      it('should include Link header when there are more plan pages', async () => {
        // Create project
        const projectResponse = await server.inject({
          method: 'POST',
          url: '/projects',
          payload: { name: 'Project with Plans' },
        });
        const project = JSON.parse(projectResponse.body);

        // Add 5 plans
        for (let i = 1; i <= 5; i++) {
          testDb
            .insert(schema.plans)
            .values({
              id: `plan-${i}`,
              projectId: project.id,
              name: `Plan ${i}`,
              pageNumber: i,
              pageCount: 1,
              filePath: `/test/plan${i}.pdf`,
              fileSize: 1000,
              fileHash: `hash${i}`,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .run();
        }

        // Get first page
        const response = await server.inject({
          method: 'GET',
          url: `/projects/${project.id}/plans?limit=2`,
        });

        expect(response.statusCode).toBe(200);
        expect(response.headers.link).toBeDefined();

        const linkHeader = response.headers.link as string;
        const body = JSON.parse(response.body);

        // Verify Link header includes project ID in path
        expect(linkHeader).toContain(`/projects/${project.id}/plans`);
        expect(linkHeader).toContain('limit=2');
        expect(linkHeader).toMatch(/cursor=[^>&]+/);

        // Extract and verify cursor
        const cursorMatch = /cursor=([^>&]+)/.exec(linkHeader);
        expect(cursorMatch?.[1]).toBe(body.pagination.nextCursor);
      });

      it('should not include Link header when no more plan pages', async () => {
        // Create project
        const projectResponse = await server.inject({
          method: 'POST',
          url: '/projects',
          payload: { name: 'Project' },
        });
        const project = JSON.parse(projectResponse.body);

        // Add 2 plans
        for (let i = 1; i <= 2; i++) {
          testDb
            .insert(schema.plans)
            .values({
              id: `plan-${i}`,
              projectId: project.id,
              name: `Plan ${i}`,
              pageNumber: i,
              pageCount: 1,
              filePath: `/test/plan${i}.pdf`,
              fileSize: 1000,
              fileHash: `hash${i}`,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .run();
        }

        // Get all plans
        const response = await server.inject({
          method: 'GET',
          url: `/projects/${project.id}/plans?limit=10`,
        });

        expect(response.statusCode).toBe(200);
        expect(response.headers.link).toBeUndefined();

        const body = JSON.parse(response.body);
        expect(body.pagination.hasMore).toBe(false);
      });

      it('should not include Link header for empty plan list', async () => {
        // Create project with no plans
        const projectResponse = await server.inject({
          method: 'POST',
          url: '/projects',
          payload: { name: 'Empty Project' },
        });
        const project = JSON.parse(projectResponse.body);

        const response = await server.inject({
          method: 'GET',
          url: `/projects/${project.id}/plans`,
        });

        expect(response.statusCode).toBe(200);
        expect(response.headers.link).toBeUndefined();

        const body = JSON.parse(response.body);
        expect(body.items).toHaveLength(0);
      });
    });
  });
});
