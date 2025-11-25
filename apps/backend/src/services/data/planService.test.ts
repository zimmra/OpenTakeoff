/**
 * Plan Service Tests
 * Unit tests for plan CRUD operations and metadata access
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '../../db/schema.js';
import { PlanService } from './planService.js';
import { ProjectService } from './projectService.js';
import { ServiceError, ServiceErrorCode } from './types.js';

describe('PlanService', () => {
  let sqlite: Database.Database;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let planService: PlanService;
  let projectService: ProjectService;
  let testProjectId: string;

  beforeEach(async () => {
    // Create in-memory database for testing
    sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');

    db = drizzle(sqlite, { schema });

    // Apply migrations
    migrate(db, { migrationsFolder: './drizzle' });

    // Create service instances
    planService = new PlanService(db);
    projectService = new ProjectService(db);

    // Create a test project
    const project = await projectService.create({ name: 'Test Project' });
    testProjectId = project.id;
  });

  afterEach(() => {
    sqlite.close();
  });

  describe('create', () => {
    it('should create a new plan with all fields', async () => {
      const input = {
        projectId: testProjectId,
        name: 'Test Plan',
        pageNumber: 1,
        pageCount: 5,
        filePath: '/test/path.pdf',
        fileSize: 1024000,
        fileHash: 'abc123def456',
        width: 800,
        height: 600,
      };

      const plan = await planService.create(input);

      expect(plan.id).toBeDefined();
      expect(plan.projectId).toBe(testProjectId);
      expect(plan.name).toBe('Test Plan');
      expect(plan.pageNumber).toBe(1);
      expect(plan.pageCount).toBe(5);
      expect(plan.filePath).toBe('/test/path.pdf');
      expect(plan.fileSize).toBe(1024000);
      expect(plan.fileHash).toBe('abc123def456');
      expect(plan.width).toBe(800);
      expect(plan.height).toBe(600);
      expect(plan.createdAt).toBeInstanceOf(Date);
      expect(plan.updatedAt).toBeInstanceOf(Date);
    });

    it('should create a plan with minimal fields (defaults)', async () => {
      const input = {
        projectId: testProjectId,
        name: 'Minimal Plan',
        pageCount: 1,
        filePath: '/test/minimal.pdf',
        fileSize: 512000,
        fileHash: 'minimal123',
      };

      const plan = await planService.create(input);

      expect(plan.id).toBeDefined();
      expect(plan.pageNumber).toBe(1); // Default
      expect(plan.width).toBeNull();
      expect(plan.height).toBeNull();
    });

    it('should throw ServiceError for non-existent project', async () => {
      const input = {
        projectId: 'non-existent-project',
        name: 'Invalid Plan',
        pageCount: 1,
        filePath: '/test/invalid.pdf',
        fileSize: 1000,
        fileHash: 'invalid123',
      };

      await expect(planService.create(input)).rejects.toThrow(ServiceError);
      await expect(planService.create(input)).rejects.toMatchObject({
        code: ServiceErrorCode.FOREIGN_KEY_VIOLATION,
      });
    });
  });

  describe('getById', () => {
    it('should retrieve an existing plan', async () => {
      const created = await planService.create({
        projectId: testProjectId,
        name: 'Test Plan',
        pageCount: 1,
        filePath: '/test/path.pdf',
        fileSize: 1000,
        fileHash: 'abc123',
      });

      const retrieved = await planService.getById(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.name).toBe('Test Plan');
      expect(retrieved?.filePath).toBe('/test/path.pdf');
    });

    it('should return null for non-existent plan', async () => {
      const retrieved = await planService.getById('non-existent-id');

      expect(retrieved).toBeNull();
    });
  });

  describe('getByIdInProject', () => {
    it('should retrieve a plan in the correct project', async () => {
      const created = await planService.create({
        projectId: testProjectId,
        name: 'Test Plan',
        pageCount: 1,
        filePath: '/test/path.pdf',
        fileSize: 1000,
        fileHash: 'abc123',
      });

      const retrieved = await planService.getByIdInProject(testProjectId, created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
    });

    it('should return null if plan is in different project', async () => {
      const plan = await planService.create({
        projectId: testProjectId,
        name: 'Test Plan',
        pageCount: 1,
        filePath: '/test/path.pdf',
        fileSize: 1000,
        fileHash: 'abc123',
      });

      const retrieved = await planService.getByIdInProject('wrong-project-id', plan.id);

      expect(retrieved).toBeNull();
    });
  });

  describe('getByFileHash', () => {
    it('should find plan by file hash', async () => {
      await planService.create({
        projectId: testProjectId,
        name: 'Test Plan',
        pageCount: 1,
        filePath: '/test/path.pdf',
        fileSize: 1000,
        fileHash: 'unique-hash-123',
      });

      const found = await planService.getByFileHash('unique-hash-123');

      expect(found).toBeDefined();
      expect(found?.fileHash).toBe('unique-hash-123');
    });

    it('should scope hash search to project when specified', async () => {
      const otherProject = await projectService.create({ name: 'Other Project' });

      await planService.create({
        projectId: testProjectId,
        name: 'Plan 1',
        pageCount: 1,
        filePath: '/test/path1.pdf',
        fileSize: 1000,
        fileHash: 'same-hash',
      });

      await planService.create({
        projectId: otherProject.id,
        name: 'Plan 2',
        pageCount: 1,
        filePath: '/test/path2.pdf',
        fileSize: 1000,
        fileHash: 'same-hash',
      });

      const found = await planService.getByFileHash('same-hash', testProjectId);

      expect(found).toBeDefined();
      expect(found?.projectId).toBe(testProjectId);
    });

    it('should return null for non-existent hash', async () => {
      const found = await planService.getByFileHash('non-existent-hash');

      expect(found).toBeNull();
    });
  });

  describe('list', () => {
    it('should return empty list when no plans exist', async () => {
      const result = await planService.list();

      expect(result.items).toHaveLength(0);
      expect(result.pagination.count).toBe(0);
      expect(result.pagination.hasMore).toBe(false);
    });

    it('should list all plans', async () => {
      for (let i = 1; i <= 3; i++) {
        await planService.create({
          projectId: testProjectId,
          name: `Plan ${i}`,
          pageNumber: i, // Use unique page numbers
          pageCount: 1,
          filePath: `/test/plan${i}.pdf`,
          fileSize: 1000,
          fileHash: `hash${i}`,
        });
      }

      const result = await planService.list();

      expect(result.items).toHaveLength(3);
      expect(result.pagination.hasMore).toBe(false);
      // Should return metadata DTOs (no filePath)
      expect(result.items[0]).not.toHaveProperty('filePath');
    });

    it('should handle pagination', async () => {
      for (let i = 1; i <= 5; i++) {
        await planService.create({
          projectId: testProjectId,
          name: `Plan ${i}`,
          pageNumber: i, // Use unique page numbers
          pageCount: 1,
          filePath: `/test/plan${i}.pdf`,
          fileSize: 1000,
          fileHash: `hash${i}`,
        });
      }

      const page1 = await planService.list({ limit: 2 });
      expect(page1.items).toHaveLength(2);
      expect(page1.pagination.hasMore).toBe(true);

      const nextCursor = page1.pagination.nextCursor;
      if (!nextCursor) throw new Error('Expected nextCursor to be defined');
      const page2 = await planService.list({ limit: 2, cursor: nextCursor });
      expect(page2.items).toHaveLength(2);
    });
  });

  describe('listByProject', () => {
    it('should list plans for specific project', async () => {
      const otherProject = await projectService.create({ name: 'Other Project' });

      // Create plans in test project
      await planService.create({
        projectId: testProjectId,
        name: 'Plan 1',
        pageNumber: 1,
        pageCount: 1,
        filePath: '/test/plan1.pdf',
        fileSize: 1000,
        fileHash: 'hash1',
      });

      await planService.create({
        projectId: testProjectId,
        name: 'Plan 2',
        pageNumber: 2,
        pageCount: 1,
        filePath: '/test/plan2.pdf',
        fileSize: 1000,
        fileHash: 'hash2',
      });

      // Create plan in other project
      await planService.create({
        projectId: otherProject.id,
        name: 'Other Plan',
        pageCount: 1,
        filePath: '/test/other.pdf',
        fileSize: 1000,
        fileHash: 'hash3',
      });

      const result = await planService.listByProject(testProjectId);

      expect(result.items).toHaveLength(2);
      expect(result.items.every(p => p.projectId === testProjectId)).toBe(true);
    });

    it('should return empty list for project with no plans', async () => {
      const emptyProject = await projectService.create({ name: 'Empty Project' });
      const result = await planService.listByProject(emptyProject.id);

      expect(result.items).toHaveLength(0);
    });

    it('should handle pagination for project plans', async () => {
      for (let i = 1; i <= 5; i++) {
        await planService.create({
          projectId: testProjectId,
          name: `Plan ${i}`,
          pageNumber: i, // Use unique page numbers
          pageCount: 1,
          filePath: `/test/plan${i}.pdf`,
          fileSize: 1000,
          fileHash: `hash${i}`,
        });
      }

      const page1 = await planService.listByProject(testProjectId, { limit: 3 });
      expect(page1.items).toHaveLength(3);
      expect(page1.pagination.hasMore).toBe(true);

      const nextCursor = page1.pagination.nextCursor;
      if (!nextCursor) throw new Error('Expected nextCursor to be defined');
      const page2 = await planService.listByProject(testProjectId, {
        limit: 3,
        cursor: nextCursor,
      });
      expect(page2.items).toHaveLength(2);
      expect(page2.pagination.hasMore).toBe(false);
    });
  });

  describe('update', () => {
    it('should update plan name', async () => {
      const created = await planService.create({
        projectId: testProjectId,
        name: 'Original Name',
        pageCount: 1,
        filePath: '/test/path.pdf',
        fileSize: 1000,
        fileHash: 'abc123',
      });

      const updated = await planService.update(created.id, { name: 'Updated Name' });

      expect(updated).toBeDefined();
      expect(updated?.name).toBe('Updated Name');
    });

    it('should update page number', async () => {
      const created = await planService.create({
        projectId: testProjectId,
        name: 'Test Plan',
        pageNumber: 1,
        pageCount: 5,
        filePath: '/test/path.pdf',
        fileSize: 1000,
        fileHash: 'abc123',
      });

      const updated = await planService.update(created.id, { pageNumber: 3 });

      expect(updated).toBeDefined();
      expect(updated?.pageNumber).toBe(3);
    });

    it('should update updatedAt timestamp', async () => {
      const created = await planService.create({
        projectId: testProjectId,
        name: 'Test Plan',
        pageCount: 1,
        filePath: '/test/path.pdf',
        fileSize: 1000,
        fileHash: 'abc123',
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const updated = await planService.update(created.id, { name: 'Updated' });

      expect(updated).toBeDefined();
      if (!updated) throw new Error('Expected updated to be defined');
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime());
    });

    it('should return null for non-existent plan', async () => {
      const updated = await planService.update('non-existent-id', { name: 'Updated' });

      expect(updated).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete an existing plan', async () => {
      const created = await planService.create({
        projectId: testProjectId,
        name: 'To Delete',
        pageCount: 1,
        filePath: '/test/path.pdf',
        fileSize: 1000,
        fileHash: 'abc123',
      });

      const deleted = await planService.delete(created.id);

      expect(deleted).toBeDefined();
      expect(deleted?.id).toBe(created.id);

      const retrieved = await planService.getById(created.id);
      expect(retrieved).toBeNull();
    });

    it('should return null for non-existent plan', async () => {
      const deleted = await planService.delete('non-existent-id');

      expect(deleted).toBeNull();
    });

    it('should cascade delete related stamps and locations', async () => {
      const plan = await planService.create({
        projectId: testProjectId,
        name: 'Plan with Data',
        pageCount: 1,
        filePath: '/test/path.pdf',
        fileSize: 1000,
        fileHash: 'abc123',
      });

      // Insert a device for stamps
      db.insert(schema.devices)
        .values({
          id: 'test-device',
          projectId: testProjectId,
          name: 'Test Device',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .run();

      // Insert a location
      db.insert(schema.locations)
        .values({
          id: 'test-location',
          planId: plan.id,
          name: 'Test Location',
          type: 'rectangle',
          bounds: { x: 0, y: 0, width: 100, height: 100 },
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .run();

      // Insert a stamp
      db.insert(schema.stamps)
        .values({
          id: 'test-stamp',
          planId: plan.id,
          deviceId: 'test-device',
          position: { x: 50, y: 50, scale: 1 },
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .run();

      // Delete plan
      await planService.delete(plan.id);

      // Verify cascades
      const locations = db.select().from(schema.locations).all();
      const stamps = db.select().from(schema.stamps).all();

      expect(locations).toHaveLength(0);
      expect(stamps).toHaveLength(0);
    });
  });

  describe('deleteByProject', () => {
    it('should delete all plans for a project', async () => {
      // Create plans
      await planService.create({
        projectId: testProjectId,
        name: 'Plan 1',
        pageNumber: 1,
        pageCount: 1,
        filePath: '/test/plan1.pdf',
        fileSize: 1000,
        fileHash: 'hash1',
      });

      await planService.create({
        projectId: testProjectId,
        name: 'Plan 2',
        pageNumber: 2,
        pageCount: 1,
        filePath: '/test/plan2.pdf',
        fileSize: 1000,
        fileHash: 'hash2',
      });

      const count = await planService.deleteByProject(testProjectId);

      expect(count).toBe(2);

      const remaining = await planService.listByProject(testProjectId);
      expect(remaining.items).toHaveLength(0);
    });

    it('should return 0 for project with no plans', async () => {
      const count = await planService.deleteByProject(testProjectId);

      expect(count).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should wrap database errors in ServiceError', async () => {
      // Force a database error by closing the connection
      sqlite.close();

      await expect(planService.list()).rejects.toThrow(ServiceError);
      await expect(planService.list()).rejects.toMatchObject({
        code: ServiceErrorCode.DATABASE_ERROR,
      });
    });
  });
});
