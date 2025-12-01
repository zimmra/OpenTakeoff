/**
 * Device Service Tests
 * Unit tests for device CRUD operations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '../../db/schema.js';
import { DeviceService } from './deviceService.js';
import { ProjectService } from './projectService.js';
import { ServiceError, ServiceErrorCode } from './types.js';

describe('DeviceService', () => {
  let sqlite: Database.Database;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let deviceService: DeviceService;
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
    deviceService = new DeviceService(db);
    projectService = new ProjectService(db);

    // Create a test project
    const project = await projectService.create({ name: 'Test Project' });
    testProjectId = project.id;
  });

  afterEach(() => {
    sqlite.close();
  });

  describe('create', () => {
    it('should create a new device with minimal data', async () => {
      const input = {
        projectId: testProjectId,
        name: 'Test Device',
      };

      const device = await deviceService.create(input);

      expect(device.id).toBeDefined();
      expect(device.projectId).toBe(testProjectId);
      expect(device.name).toBe('Test Device');
      expect(device.description).toBeNull();
      expect(device.color).toBeNull();
      expect(device.iconKey).toBeNull();
      expect(device.createdAt).toBeInstanceOf(Date);
      expect(device.updatedAt).toBeInstanceOf(Date);
    });

    it('should create a device with all fields', async () => {
      const input = {
        projectId: testProjectId,
        name: 'Full Device',
        description: 'A test device with all fields',
        color: '#FF0000',
        iconKey: 'outlet',
      };

      const device = await deviceService.create(input);

      expect(device.name).toBe('Full Device');
      expect(device.description).toBe('A test device with all fields');
      expect(device.color).toBe('#FF0000');
      expect(device.iconKey).toBe('outlet');
    });

    it('should generate unique IDs for each device', async () => {
      const device1 = await deviceService.create({
        projectId: testProjectId,
        name: 'Device 1',
      });
      const device2 = await deviceService.create({
        projectId: testProjectId,
        name: 'Device 2',
      });

      expect(device1.id).not.toBe(device2.id);
    });

    it('should throw ALREADY_EXISTS for duplicate device name in same project', async () => {
      await deviceService.create({
        projectId: testProjectId,
        name: 'Duplicate Device',
      });

      await expect(
        deviceService.create({
          projectId: testProjectId,
          name: 'Duplicate Device',
        }),
      ).rejects.toThrow(ServiceError);

      try {
        await deviceService.create({
          projectId: testProjectId,
          name: 'Duplicate Device',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceError);
        expect((error as ServiceError).code).toBe(ServiceErrorCode.ALREADY_EXISTS);
      }
    });

    it('should allow same device name in different projects', async () => {
      const project2 = await projectService.create({ name: 'Project 2' });

      const device1 = await deviceService.create({
        projectId: testProjectId,
        name: 'Same Name',
      });
      const device2 = await deviceService.create({
        projectId: project2.id,
        name: 'Same Name',
      });

      expect(device1.id).toBeDefined();
      expect(device2.id).toBeDefined();
      expect(device1.id).not.toBe(device2.id);
    });
  });

  describe('getById', () => {
    it('should retrieve an existing device', async () => {
      const created = await deviceService.create({
        projectId: testProjectId,
        name: 'Test Device',
        description: 'Test description',
      });

      const retrieved = await deviceService.getById(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.name).toBe('Test Device');
      expect(retrieved?.description).toBe('Test description');
    });

    it('should return null for non-existent device', async () => {
      const retrieved = await deviceService.getById('non-existent-id');

      expect(retrieved).toBeNull();
    });
  });

  describe('listByProject', () => {
    it('should return empty list when no devices exist', async () => {
      const result = await deviceService.listByProject(testProjectId);

      expect(result.items).toHaveLength(0);
      expect(result.pagination.count).toBe(0);
      expect(result.pagination.hasMore).toBe(false);
      expect(result.pagination.nextCursor).toBeNull();
    });

    it('should list all devices for a project', async () => {
      await deviceService.create({ projectId: testProjectId, name: 'Device 1' });
      await deviceService.create({ projectId: testProjectId, name: 'Device 2' });
      await deviceService.create({ projectId: testProjectId, name: 'Device 3' });

      const result = await deviceService.listByProject(testProjectId);

      expect(result.items).toHaveLength(3);
      expect(result.pagination.count).toBe(3);
      expect(result.pagination.hasMore).toBe(false);
    });

    it('should only list devices for the specified project', async () => {
      const project2 = await projectService.create({ name: 'Project 2' });

      await deviceService.create({ projectId: testProjectId, name: 'Device P1' });
      await deviceService.create({ projectId: project2.id, name: 'Device P2' });

      const result = await deviceService.listByProject(testProjectId);

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.name).toBe('Device P1');
    });

    it('should respect pagination limit', async () => {
      // Create 5 devices
      for (let i = 1; i <= 5; i++) {
        await deviceService.create({ projectId: testProjectId, name: `Device ${i}` });
      }

      const result = await deviceService.listByProject(testProjectId, { limit: 3 });

      expect(result.items).toHaveLength(3);
      expect(result.pagination.count).toBe(3);
      expect(result.pagination.hasMore).toBe(true);
      expect(result.pagination.nextCursor).toBeDefined();
    });

    it('should handle cursor-based pagination', async () => {
      // Create 5 devices
      for (let i = 1; i <= 5; i++) {
        await deviceService.create({ projectId: testProjectId, name: `Device ${i}` });
      }

      // Get first page
      const page1 = await deviceService.listByProject(testProjectId, { limit: 2 });
      expect(page1.items).toHaveLength(2);
      expect(page1.pagination.hasMore).toBe(true);

      // Get second page using cursor
      const cursor1 = page1.pagination.nextCursor;
      if (!cursor1) throw new Error('Expected nextCursor to be defined');
      const page2 = await deviceService.listByProject(testProjectId, { limit: 2, cursor: cursor1 });
      expect(page2.items).toHaveLength(2);
      expect(page2.pagination.hasMore).toBe(true);

      // Get third page
      const cursor2 = page2.pagination.nextCursor;
      if (!cursor2) throw new Error('Expected nextCursor to be defined');
      const page3 = await deviceService.listByProject(testProjectId, { limit: 2, cursor: cursor2 });
      expect(page3.items).toHaveLength(1);
      expect(page3.pagination.hasMore).toBe(false);

      // Ensure no overlap between pages
      const allIds = [
        ...page1.items.map((d) => d.id),
        ...page2.items.map((d) => d.id),
        ...page3.items.map((d) => d.id),
      ];
      const uniqueIds = new Set(allIds);
      expect(uniqueIds.size).toBe(5);
    });

    it('should enforce maximum limit', async () => {
      const result = await deviceService.listByProject(testProjectId, { limit: 200 });
      // Should be capped at MAX_LIMIT (100)
      expect(result.pagination.count).toBeLessThanOrEqual(100);
    });
  });

  describe('update', () => {
    it('should update device name', async () => {
      const created = await deviceService.create({
        projectId: testProjectId,
        name: 'Original Name',
      });

      const updated = await deviceService.update(created.id, { name: 'Updated Name' });

      expect(updated).toBeDefined();
      expect(updated?.name).toBe('Updated Name');
    });

    it('should update device description', async () => {
      const created = await deviceService.create({
        projectId: testProjectId,
        name: 'Test Device',
        description: 'Original description',
      });

      const updated = await deviceService.update(created.id, { description: 'Updated description' });

      expect(updated).toBeDefined();
      expect(updated?.description).toBe('Updated description');
      expect(updated?.name).toBe('Test Device'); // Name unchanged
    });

    it('should update device color', async () => {
      const created = await deviceService.create({
        projectId: testProjectId,
        name: 'Test Device',
        color: '#FF0000',
      });

      const updated = await deviceService.update(created.id, { color: '#00FF00' });

      expect(updated).toBeDefined();
      expect(updated?.color).toBe('#00FF00');
    });

    it('should update device iconKey', async () => {
      const created = await deviceService.create({
        projectId: testProjectId,
        name: 'Test Device',
        iconKey: 'outlet',
      });

      const updated = await deviceService.update(created.id, { iconKey: 'switch' });

      expect(updated).toBeDefined();
      expect(updated?.iconKey).toBe('switch');
    });

    it('should update multiple fields at once', async () => {
      const created = await deviceService.create({
        projectId: testProjectId,
        name: 'Original',
        description: 'Original desc',
        color: '#FF0000',
      });

      const updated = await deviceService.update(created.id, {
        name: 'Updated',
        description: 'Updated desc',
        color: '#00FF00',
      });

      expect(updated).toBeDefined();
      expect(updated?.name).toBe('Updated');
      expect(updated?.description).toBe('Updated desc');
      expect(updated?.color).toBe('#00FF00');
    });

    it('should update updatedAt timestamp', async () => {
      const created = await deviceService.create({
        projectId: testProjectId,
        name: 'Test Device',
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const updated = await deviceService.update(created.id, { name: 'Updated' });

      expect(updated).toBeDefined();
      if (!updated) throw new Error('Expected updated to be defined');
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime());
    });

    it('should return null for non-existent device', async () => {
      const updated = await deviceService.update('non-existent-id', { name: 'Updated' });

      expect(updated).toBeNull();
    });

    it('should throw ALREADY_EXISTS when renaming to existing name', async () => {
      await deviceService.create({
        projectId: testProjectId,
        name: 'Device A',
      });

      const deviceB = await deviceService.create({
        projectId: testProjectId,
        name: 'Device B',
      });

      await expect(deviceService.update(deviceB.id, { name: 'Device A' })).rejects.toThrow(
        ServiceError,
      );
    });
  });

  describe('delete', () => {
    it('should delete an existing device', async () => {
      const created = await deviceService.create({
        projectId: testProjectId,
        name: 'To Delete',
      });

      const deleted = await deviceService.delete(created.id);

      expect(deleted).toBe(true);

      // Verify deletion
      const retrieved = await deviceService.getById(created.id);
      expect(retrieved).toBeNull();
    });

    it('should return false for non-existent device', async () => {
      const deleted = await deviceService.delete('non-existent-id');

      expect(deleted).toBe(false);
    });

    it('should cascade delete related stamps', async () => {
      // Create device
      const device = await deviceService.create({
        projectId: testProjectId,
        name: 'Device with Stamps',
      });

      // Create a plan for stamps
      db.insert(schema.plans)
        .values({
          id: 'test-plan-id',
          projectId: testProjectId,
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

      // Create a stamp
      db.insert(schema.stamps)
        .values({
          id: 'test-stamp',
          planId: 'test-plan-id',
          deviceId: device.id,
          position: { x: 50, y: 50, scale: 1 },
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .run();

      // Delete device
      await deviceService.delete(device.id);

      // Verify stamp was also deleted (cascade)
      const stamps = db.select().from(schema.stamps).all();
      expect(stamps).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('should wrap database errors in ServiceError', async () => {
      // Force a database error by closing the connection
      sqlite.close();

      await expect(deviceService.listByProject(testProjectId)).rejects.toThrow(ServiceError);
      await expect(deviceService.listByProject(testProjectId)).rejects.toMatchObject({
        code: ServiceErrorCode.DATABASE_ERROR,
      });
    });
  });
});
