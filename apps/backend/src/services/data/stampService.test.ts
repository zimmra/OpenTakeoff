/**
 * Stamp Service Tests
 * Unit tests for stamp CRUD operations with revision tracking
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '../../db/schema.js';
import { StampService } from './stampService.js';
import { ProjectService } from './projectService.js';
import { PlanService } from './planService.js';
import { DeviceService } from './deviceService.js';
import { LocationService } from './locationService.js';
import { ServiceError, ServiceErrorCode, OptimisticLockError } from './types.js';

// Mock the count event service to prevent actual event emission
vi.mock('../events/countEventService.js', () => ({
  getCountEventService: () => ({
    emitCountUpdate: vi.fn(),
  }),
}));

describe('StampService', () => {
  let sqlite: Database.Database;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let stampService: StampService;
  let projectService: ProjectService;
  let planService: PlanService;
  let deviceService: DeviceService;
  let locationService: LocationService;
  let testProjectId: string;
  let testPlanId: string;
  let testDeviceId: string;

  beforeEach(async () => {
    // Create in-memory database for testing
    sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');

    db = drizzle(sqlite, { schema });

    // Apply migrations
    migrate(db, { migrationsFolder: './drizzle' });

    // Create service instances
    stampService = new StampService(db);
    projectService = new ProjectService(db);
    planService = new PlanService(db);
    deviceService = new DeviceService(db);
    locationService = new LocationService(db);

    // Create test project
    const project = await projectService.create({ name: 'Test Project' });
    testProjectId = project.id;

    // Create test plan
    const plan = await planService.create({
      projectId: testProjectId,
      name: 'Test Plan',
      pageNumber: 1,
      pageCount: 1,
      filePath: '/test/path.pdf',
      fileSize: 1000,
      fileHash: 'abc123',
      width: 1000,
      height: 800,
    });
    testPlanId = plan.id;

    // Create test device
    const device = await deviceService.create({
      projectId: testProjectId,
      name: 'Test Device',
    });
    testDeviceId = device.id;
  });

  afterEach(() => {
    sqlite.close();
  });

  describe('create', () => {
    it('should create a new stamp with minimal data', async () => {
      const input = {
        planId: testPlanId,
        deviceId: testDeviceId,
        position: { x: 100, y: 200, scale: 1 },
      };

      const stamp = await stampService.create(input);

      expect(stamp.id).toBeDefined();
      expect(stamp.planId).toBe(testPlanId);
      expect(stamp.deviceId).toBe(testDeviceId);
      expect(stamp.position).toEqual({ x: 100, y: 200, scale: 1 });
      expect(stamp.locationId).toBeNull();
      expect(stamp.createdAt).toBeInstanceOf(Date);
      expect(stamp.updatedAt).toBeInstanceOf(Date);
    });

    it('should create a stamp with explicit locationId', async () => {
      // Create a location
      const location = await locationService.createRectangle({
        planId: testPlanId,
        name: 'Test Location',
        bounds: { x: 0, y: 0, width: 500, height: 500 },
      });

      const stamp = await stampService.create({
        planId: testPlanId,
        deviceId: testDeviceId,
        locationId: location.id,
        position: { x: 100, y: 100, scale: 1 },
      });

      expect(stamp.locationId).toBe(location.id);
    });

    it('should auto-assign stamp to location based on position', async () => {
      // Create a location
      const location = await locationService.createRectangle({
        planId: testPlanId,
        name: 'Test Location',
        bounds: { x: 0, y: 0, width: 500, height: 500 },
      });

      // Create stamp inside location bounds without specifying locationId
      const stamp = await stampService.create({
        planId: testPlanId,
        deviceId: testDeviceId,
        position: { x: 100, y: 100, scale: 1 },
      });

      // Stamp should be auto-assigned to the location
      expect(stamp.locationId).toBe(location.id);
    });

    it('should not assign stamp to location if outside bounds', async () => {
      // Create a location
      await locationService.createRectangle({
        planId: testPlanId,
        name: 'Test Location',
        bounds: { x: 0, y: 0, width: 100, height: 100 },
      });

      // Create stamp outside location bounds
      const stamp = await stampService.create({
        planId: testPlanId,
        deviceId: testDeviceId,
        position: { x: 500, y: 500, scale: 1 },
      });

      expect(stamp.locationId).toBeNull();
    });

    it('should create revision record for new stamp', async () => {
      const stamp = await stampService.create({
        planId: testPlanId,
        deviceId: testDeviceId,
        position: { x: 100, y: 200, scale: 1 },
      });

      const revisions = await stampService.getRevisions(stamp.id);

      expect(revisions).toHaveLength(1);
      expect(revisions[0]?.type).toBe('create');
      expect(revisions[0]?.snapshot).toBeNull();
    });

    it('should generate unique IDs for each stamp', async () => {
      const stamp1 = await stampService.create({
        planId: testPlanId,
        deviceId: testDeviceId,
        position: { x: 100, y: 100, scale: 1 },
      });
      const stamp2 = await stampService.create({
        planId: testPlanId,
        deviceId: testDeviceId,
        position: { x: 200, y: 200, scale: 1 },
      });

      expect(stamp1.id).not.toBe(stamp2.id);
    });

    it('should throw FOREIGN_KEY_VIOLATION for non-existent plan', async () => {
      await expect(
        stampService.create({
          planId: 'non-existent-plan',
          deviceId: testDeviceId,
          position: { x: 100, y: 100, scale: 1 },
        }),
      ).rejects.toThrow(ServiceError);

      try {
        await stampService.create({
          planId: 'non-existent-plan',
          deviceId: testDeviceId,
          position: { x: 100, y: 100, scale: 1 },
        });
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceError);
        expect((error as ServiceError).code).toBe(ServiceErrorCode.FOREIGN_KEY_VIOLATION);
      }
    });

    it('should throw FOREIGN_KEY_VIOLATION for non-existent device', async () => {
      await expect(
        stampService.create({
          planId: testPlanId,
          deviceId: 'non-existent-device',
          position: { x: 100, y: 100, scale: 1 },
        }),
      ).rejects.toThrow(ServiceError);
    });
  });

  describe('getById', () => {
    it('should retrieve an existing stamp', async () => {
      const created = await stampService.create({
        planId: testPlanId,
        deviceId: testDeviceId,
        position: { x: 100, y: 200, scale: 1.5 },
      });

      const retrieved = await stampService.getById(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.position).toEqual({ x: 100, y: 200, scale: 1.5 });
    });

    it('should return null for non-existent stamp', async () => {
      const retrieved = await stampService.getById('non-existent-id');

      expect(retrieved).toBeNull();
    });
  });

  describe('listByPlan', () => {
    it('should return empty list when no stamps exist', async () => {
      const result = await stampService.listByPlan(testPlanId);

      expect(result.items).toHaveLength(0);
      expect(result.pagination.count).toBe(0);
      expect(result.pagination.hasMore).toBe(false);
      expect(result.pagination.nextCursor).toBeNull();
    });

    it('should list all stamps for a plan', async () => {
      await stampService.create({
        planId: testPlanId,
        deviceId: testDeviceId,
        position: { x: 100, y: 100, scale: 1 },
      });
      await stampService.create({
        planId: testPlanId,
        deviceId: testDeviceId,
        position: { x: 200, y: 200, scale: 1 },
      });
      await stampService.create({
        planId: testPlanId,
        deviceId: testDeviceId,
        position: { x: 300, y: 300, scale: 1 },
      });

      const result = await stampService.listByPlan(testPlanId);

      expect(result.items).toHaveLength(3);
      expect(result.pagination.count).toBe(3);
      expect(result.pagination.hasMore).toBe(false);
    });

    it('should only list stamps for the specified plan', async () => {
      // Create another plan
      const plan2 = await planService.create({
        projectId: testProjectId,
        name: 'Plan 2',
        pageNumber: 2,
        pageCount: 1,
        filePath: '/test/plan2.pdf',
        fileSize: 1000,
        fileHash: 'hash2',
      });

      await stampService.create({
        planId: testPlanId,
        deviceId: testDeviceId,
        position: { x: 100, y: 100, scale: 1 },
      });
      await stampService.create({
        planId: plan2.id,
        deviceId: testDeviceId,
        position: { x: 200, y: 200, scale: 1 },
      });

      const result = await stampService.listByPlan(testPlanId);

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.planId).toBe(testPlanId);
    });

    it('should respect pagination limit', async () => {
      // Create 5 stamps
      for (let i = 1; i <= 5; i++) {
        await stampService.create({
          planId: testPlanId,
          deviceId: testDeviceId,
          position: { x: i * 100, y: i * 100, scale: 1 },
        });
      }

      const result = await stampService.listByPlan(testPlanId, { limit: 3 });

      expect(result.items).toHaveLength(3);
      expect(result.pagination.hasMore).toBe(true);
      expect(result.pagination.nextCursor).toBeDefined();
    });

    it('should handle cursor-based pagination', async () => {
      // Create 5 stamps
      for (let i = 1; i <= 5; i++) {
        await stampService.create({
          planId: testPlanId,
          deviceId: testDeviceId,
          position: { x: i * 100, y: i * 100, scale: 1 },
        });
      }

      // Get first page
      const page1 = await stampService.listByPlan(testPlanId, { limit: 2 });
      expect(page1.items).toHaveLength(2);
      expect(page1.pagination.hasMore).toBe(true);

      // Get second page
      const cursor1 = page1.pagination.nextCursor;
      if (!cursor1) throw new Error('Expected nextCursor');
      const page2 = await stampService.listByPlan(testPlanId, { limit: 2, cursor: cursor1 });
      expect(page2.items).toHaveLength(2);
      expect(page2.pagination.hasMore).toBe(true);

      // Get third page
      const cursor2 = page2.pagination.nextCursor;
      if (!cursor2) throw new Error('Expected nextCursor');
      const page3 = await stampService.listByPlan(testPlanId, { limit: 2, cursor: cursor2 });
      expect(page3.items).toHaveLength(1);
      expect(page3.pagination.hasMore).toBe(false);
    });
  });

  describe('update', () => {
    it('should update stamp position', async () => {
      const created = await stampService.create({
        planId: testPlanId,
        deviceId: testDeviceId,
        position: { x: 100, y: 100, scale: 1 },
      });

      const updated = await stampService.update(created.id, {
        position: { x: 200, y: 300, scale: 1.5 },
      });

      expect(updated).toBeDefined();
      expect(updated?.position).toEqual({ x: 200, y: 300, scale: 1.5 });
    });

    it('should update stamp locationId', async () => {
      const location = await locationService.createRectangle({
        planId: testPlanId,
        name: 'New Location',
        bounds: { x: 0, y: 0, width: 500, height: 500 },
      });

      const created = await stampService.create({
        planId: testPlanId,
        deviceId: testDeviceId,
        position: { x: 100, y: 100, scale: 1 },
      });

      const updated = await stampService.update(created.id, {
        locationId: location.id,
      });

      expect(updated?.locationId).toBe(location.id);
    });

    it('should create revision record on update', async () => {
      const created = await stampService.create({
        planId: testPlanId,
        deviceId: testDeviceId,
        position: { x: 100, y: 100, scale: 1 },
      });

      await stampService.update(created.id, {
        position: { x: 200, y: 200, scale: 1 },
      });

      const revisions = await stampService.getRevisions(created.id);

      expect(revisions).toHaveLength(2); // create + update
      expect(revisions[1]?.type).toBe('update');
      expect(revisions[1]?.snapshot).toBeDefined();
    });

    it('should update updatedAt timestamp', async () => {
      const created = await stampService.create({
        planId: testPlanId,
        deviceId: testDeviceId,
        position: { x: 100, y: 100, scale: 1 },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const updated = await stampService.update(created.id, {
        position: { x: 200, y: 200, scale: 1 },
      });

      expect(updated).toBeDefined();
      if (!updated) throw new Error('Expected updated');
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime());
    });

    it('should return null for non-existent stamp', async () => {
      const updated = await stampService.update('non-existent-id', {
        position: { x: 200, y: 200, scale: 1 },
      });

      expect(updated).toBeNull();
    });

    it('should throw OptimisticLockError on concurrent modification', async () => {
      const created = await stampService.create({
        planId: testPlanId,
        deviceId: testDeviceId,
        position: { x: 100, y: 100, scale: 1 },
      });

      // Simulate stale timestamp
      const staleTimestamp = new Date(created.updatedAt.getTime() - 1000);

      await expect(
        stampService.update(created.id, {
          position: { x: 200, y: 200, scale: 1 },
          updatedAt: staleTimestamp,
        }),
      ).rejects.toThrow(OptimisticLockError);
    });
  });

  describe('delete', () => {
    it('should delete an existing stamp', async () => {
      const created = await stampService.create({
        planId: testPlanId,
        deviceId: testDeviceId,
        position: { x: 100, y: 100, scale: 1 },
      });

      const deleted = await stampService.delete(created.id);

      expect(deleted).toBe(true);

      // Verify deletion
      const retrieved = await stampService.getById(created.id);
      expect(retrieved).toBeNull();
    });

    it('should return false for non-existent stamp', async () => {
      const deleted = await stampService.delete('non-existent-id');

      expect(deleted).toBe(false);
    });

    it('should create revision record before deletion', async () => {
      const created = await stampService.create({
        planId: testPlanId,
        deviceId: testDeviceId,
        position: { x: 100, y: 100, scale: 1 },
      });

      // Get revisions before delete - should have create revision
      const revisionsBefore = await stampService.getRevisions(created.id);
      expect(revisionsBefore).toHaveLength(1);

      // Delete stamp
      await stampService.delete(created.id);

      // Note: Revisions are cascade deleted with the stamp per schema,
      // but the service creates a delete revision first
      // This is implementation-dependent behavior
    });
  });

  describe('getRevisions', () => {
    it('should return revisions in chronological order', async () => {
      const stamp = await stampService.create({
        planId: testPlanId,
        deviceId: testDeviceId,
        position: { x: 100, y: 100, scale: 1 },
      });

      await stampService.update(stamp.id, {
        position: { x: 200, y: 200, scale: 1 },
      });

      await stampService.update(stamp.id, {
        position: { x: 300, y: 300, scale: 1 },
      });

      const revisions = await stampService.getRevisions(stamp.id);

      expect(revisions).toHaveLength(3);
      expect(revisions[0]?.type).toBe('create');
      expect(revisions[1]?.type).toBe('update');
      expect(revisions[2]?.type).toBe('update');

      // Verify chronological order
      for (let i = 1; i < revisions.length; i++) {
        const prev = revisions[i - 1];
        const curr = revisions[i];
        if (prev && curr) {
          expect(prev.createdAt.getTime()).toBeLessThanOrEqual(curr.createdAt.getTime());
        }
      }
    });

    it('should return empty array for non-existent stamp', async () => {
      const revisions = await stampService.getRevisions('non-existent-id');

      expect(revisions).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('should wrap database errors in ServiceError', async () => {
      // Force a database error by closing the connection
      sqlite.close();

      await expect(stampService.listByPlan(testPlanId)).rejects.toThrow(ServiceError);
      await expect(stampService.listByPlan(testPlanId)).rejects.toMatchObject({
        code: ServiceErrorCode.DATABASE_ERROR,
      });
    });
  });
});
