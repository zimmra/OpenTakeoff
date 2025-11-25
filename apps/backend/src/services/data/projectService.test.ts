/**
 * Project Service Tests
 * Unit tests for project CRUD operations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '../../db/schema.js';
import { ProjectService } from './projectService.js';
import { ServiceError, ServiceErrorCode } from './types.js';

describe('ProjectService', () => {
  let sqlite: Database.Database;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let service: ProjectService;

  beforeEach(() => {
    // Create in-memory database for testing
    sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');

    db = drizzle(sqlite, { schema });

    // Apply migrations
    migrate(db, { migrationsFolder: './drizzle' });

    // Create service instance
    service = new ProjectService(db);
  });

  afterEach(() => {
    sqlite.close();
  });

  describe('create', () => {
    it('should create a new project with minimal data', async () => {
      const input = {
        name: 'Test Project',
      };

      const project = await service.create(input);

      expect(project.id).toBeDefined();
      expect(project.name).toBe('Test Project');
      expect(project.description).toBeNull();
      expect(project.createdAt).toBeInstanceOf(Date);
      expect(project.updatedAt).toBeInstanceOf(Date);
    });

    it('should create a new project with description', async () => {
      const input = {
        name: 'Test Project',
        description: 'A test project',
      };

      const project = await service.create(input);

      expect(project.id).toBeDefined();
      expect(project.name).toBe('Test Project');
      expect(project.description).toBe('A test project');
    });

    it('should generate unique IDs for each project', async () => {
      const input1 = { name: 'Project 1' };
      const input2 = { name: 'Project 2' };

      const project1 = await service.create(input1);
      const project2 = await service.create(input2);

      expect(project1.id).not.toBe(project2.id);
    });
  });

  describe('getById', () => {
    it('should retrieve an existing project', async () => {
      const created = await service.create({ name: 'Test Project' });
      const retrieved = await service.getById(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.name).toBe('Test Project');
    });

    it('should return null for non-existent project', async () => {
      const retrieved = await service.getById('non-existent-id');

      expect(retrieved).toBeNull();
    });
  });

  describe('list', () => {
    it('should return empty list when no projects exist', async () => {
      const result = await service.list();

      expect(result.items).toHaveLength(0);
      expect(result.pagination.count).toBe(0);
      expect(result.pagination.hasMore).toBe(false);
      expect(result.pagination.nextCursor).toBeNull();
    });

    it('should list all projects', async () => {
      await service.create({ name: 'Project 1' });
      await service.create({ name: 'Project 2' });
      await service.create({ name: 'Project 3' });

      const result = await service.list();

      expect(result.items).toHaveLength(3);
      expect(result.pagination.count).toBe(3);
      expect(result.pagination.hasMore).toBe(false);
    });

    it('should respect pagination limit', async () => {
      // Create 5 projects
      for (let i = 1; i <= 5; i++) {
        await service.create({ name: `Project ${i}` });
      }

      const result = await service.list({ limit: 3 });

      expect(result.items).toHaveLength(3);
      expect(result.pagination.count).toBe(3);
      expect(result.pagination.hasMore).toBe(true);
      expect(result.pagination.nextCursor).toBeDefined();
    });

    it('should handle cursor-based pagination', async () => {
      // Create 5 projects
      const projects = [];
      for (let i = 1; i <= 5; i++) {
        projects.push(await service.create({ name: `Project ${i}` }));
      }

      // Get first page
      const page1 = await service.list({ limit: 2 });
      expect(page1.items).toHaveLength(2);
      expect(page1.pagination.hasMore).toBe(true);

      // Get second page using cursor
      const cursor1 = page1.pagination.nextCursor;
      if (!cursor1) throw new Error('Expected nextCursor to be defined');
      const page2 = await service.list({ limit: 2, cursor: cursor1 });
      expect(page2.items).toHaveLength(2);
      expect(page2.pagination.hasMore).toBe(true);

      // Get third page
      const cursor2 = page2.pagination.nextCursor;
      if (!cursor2) throw new Error('Expected nextCursor to be defined');
      const page3 = await service.list({ limit: 2, cursor: cursor2 });
      expect(page3.items).toHaveLength(1);
      expect(page3.pagination.hasMore).toBe(false);
    });

    it('should enforce maximum limit', async () => {
      const result = await service.list({ limit: 200 });
      // Should be capped at MAX_LIMIT (100)
      expect(result.pagination.count).toBeLessThanOrEqual(100);
    });
  });

  describe('update', () => {
    it('should update project name', async () => {
      const created = await service.create({ name: 'Original Name' });
      const updated = await service.update(created.id, { name: 'Updated Name' });

      expect(updated).toBeDefined();
      expect(updated?.name).toBe('Updated Name');
      expect(updated?.description).toBe(created.description);
    });

    it('should update project description', async () => {
      const created = await service.create({ name: 'Test', description: 'Original' });
      const updated = await service.update(created.id, { description: 'Updated' });

      expect(updated).toBeDefined();
      expect(updated?.description).toBe('Updated');
      expect(updated?.name).toBe(created.name);
    });

    it('should update both name and description', async () => {
      const created = await service.create({ name: 'Original', description: 'Original Desc' });
      const updated = await service.update(created.id, {
        name: 'Updated',
        description: 'Updated Desc',
      });

      expect(updated).toBeDefined();
      expect(updated?.name).toBe('Updated');
      expect(updated?.description).toBe('Updated Desc');
    });

    it('should update updatedAt timestamp', async () => {
      const created = await service.create({ name: 'Test' });
      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 100));
      const updated = await service.update(created.id, { name: 'Updated' });

      expect(updated).toBeDefined();
      if (!updated) throw new Error('Expected updated to be defined');
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime());
    });

    it('should return null for non-existent project', async () => {
      const updated = await service.update('non-existent-id', { name: 'Updated' });

      expect(updated).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete an existing project', async () => {
      const created = await service.create({ name: 'To Delete' });
      const deleted = await service.delete(created.id);

      expect(deleted).toBe(true);

      // Verify deletion
      const retrieved = await service.getById(created.id);
      expect(retrieved).toBeNull();
    });

    it('should return false for non-existent project', async () => {
      const deleted = await service.delete('non-existent-id');

      expect(deleted).toBe(false);
    });

    it('should cascade delete related plans', async () => {
      // Create project
      const project = await service.create({ name: 'Project with Plans' });

      // Insert a plan directly
      db.insert(schema.plans)
        .values({
          id: 'test-plan-1',
          projectId: project.id,
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
      await service.delete(project.id);

      // Verify plan was also deleted
      const plans = db.select().from(schema.plans).all();
      expect(plans).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('should wrap database errors in ServiceError', async () => {
      // Force a database error by closing the connection
      sqlite.close();

      await expect(service.list()).rejects.toThrow(ServiceError);
      await expect(service.list()).rejects.toMatchObject({
        code: ServiceErrorCode.DATABASE_ERROR,
      });
    });
  });
});
