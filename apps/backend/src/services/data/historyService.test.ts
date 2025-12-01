/**
 * History Service Tests
 * Unit tests for undo/redo functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '../../db/schema.js';
import { HistoryService } from './historyService.js';
import { StampService } from './stampService.js';
import { LocationService } from './locationService.js';
import { ServiceError, ServiceErrorCode } from './types.js';

// Mock the count event service
vi.mock('../events/countEventService.js', () => ({
  getCountEventService: () => ({
    emitCountUpdate: vi.fn(),
  }),
}));

describe('HistoryService', () => {
  let sqlite: Database.Database;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let historyService: HistoryService;
  let stampService: StampService;
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
    historyService = new HistoryService(db);
    stampService = new StampService(db);
    locationService = new LocationService(db);

    // Create test data directly for isolation
    testProjectId = 'test-project-id';
    testPlanId = 'test-plan-id';
    testDeviceId = 'test-device-id';
    const now = new Date();

    db.insert(schema.projects)
      .values({
        id: testProjectId,
        name: 'Test Project',
        createdAt: now,
        updatedAt: now,
      })
      .run();

    db.insert(schema.plans)
      .values({
        id: testPlanId,
        projectId: testProjectId,
        name: 'Test Plan',
        pageNumber: 1,
        pageCount: 1,
        filePath: '/test/path.pdf',
        fileSize: 1000,
        fileHash: 'abc123',
        width: 1000,
        height: 800,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    db.insert(schema.devices)
      .values({
        id: testDeviceId,
        projectId: testProjectId,
        name: 'Test Device',
        createdAt: now,
        updatedAt: now,
      })
      .run();
  });

  afterEach(() => {
    sqlite.close();
  });

  describe('getHistory', () => {
    it('should return empty history for project with no revisions', async () => {
      const history = await historyService.getHistory(testProjectId);

      expect(history).toHaveLength(0);
    });

    it('should return stamp revisions', async () => {
      // Create a stamp (creates revision)
      const stamp = await stampService.create({
        planId: testPlanId,
        deviceId: testDeviceId,
        position: { x: 100, y: 100, scale: 1 },
      });

      const history = await historyService.getHistory(testProjectId);

      expect(history).toHaveLength(1);
      expect(history[0]?.entityType).toBe('stamp');
      expect(history[0]?.entityId).toBe(stamp.id);
      expect(history[0]?.type).toBe('create');
    });

    it('should return location revisions', async () => {
      // Create a location (creates revision)
      const location = await locationService.createRectangle({
        planId: testPlanId,
        name: 'Test Room',
        bounds: { x: 0, y: 0, width: 100, height: 100 },
      });

      const history = await historyService.getHistory(testProjectId);

      expect(history).toHaveLength(1);
      expect(history[0]?.entityType).toBe('location');
      expect(history[0]?.entityId).toBe(location.id);
      expect(history[0]?.type).toBe('create');
    });

    it('should include both stamp and location revisions', async () => {
      // Create stamp
      await stampService.create({
        planId: testPlanId,
        deviceId: testDeviceId,
        position: { x: 100, y: 100, scale: 1 },
      });

      // Create location
      await locationService.createRectangle({
        planId: testPlanId,
        name: 'Test Room',
        bounds: { x: 0, y: 0, width: 100, height: 100 },
      });

      const history = await historyService.getHistory(testProjectId);

      expect(history).toHaveLength(2);

      // Check that both types are present
      const entityTypes = history.map((h) => h.entityType);
      expect(entityTypes).toContain('stamp');
      expect(entityTypes).toContain('location');
    });

    it('should track update revisions with snapshots', async () => {
      const stamp = await stampService.create({
        planId: testPlanId,
        deviceId: testDeviceId,
        position: { x: 100, y: 100, scale: 1 },
      });

      await stampService.update(stamp.id, {
        position: { x: 200, y: 200, scale: 1 },
      });

      const history = await historyService.getHistory(testProjectId);

      expect(history).toHaveLength(2);

      // Find the update revision
      const updateRevision = history.find((h) => h.type === 'update');
      expect(updateRevision).toBeDefined();
      expect(updateRevision?.snapshot).toBeDefined();
    });

    it('should limit history to MAX_HISTORY_ENTRIES (100)', async () => {
      // Create many stamps (each creates a revision)
      for (let i = 0; i < 110; i++) {
        await stampService.create({
          planId: testPlanId,
          deviceId: testDeviceId,
          position: { x: i * 10, y: i * 10, scale: 1 },
        });
      }

      const history = await historyService.getHistory(testProjectId);

      // Should be capped at MAX_HISTORY_ENTRIES (100)
      expect(history.length).toBeLessThanOrEqual(100);
    });
  });

  describe('undo', () => {
    it('should return null when no history exists', async () => {
      const result = await historyService.undo(testProjectId);

      expect(result).toBeNull();
    });

    it('should undo stamp creation by deleting it', async () => {
      const stamp = await stampService.create({
        planId: testPlanId,
        deviceId: testDeviceId,
        position: { x: 100, y: 100, scale: 1 },
      });

      // Verify stamp exists
      let retrieved = await stampService.getById(stamp.id);
      expect(retrieved).toBeDefined();

      // Undo
      const result = await historyService.undo(testProjectId);

      expect(result).toBeDefined();
      expect(result?.success).toBe(true);
      expect(result?.entityType).toBe('stamp');
      expect(result?.action).toBe('undo');

      // Verify stamp is deleted
      retrieved = await stampService.getById(stamp.id);
      expect(retrieved).toBeNull();
    });

    it('should undo location creation by deleting it', async () => {
      const location = await locationService.createRectangle({
        planId: testPlanId,
        name: 'Test Room',
        bounds: { x: 0, y: 0, width: 100, height: 100 },
      });

      // Verify location exists
      let retrieved = await locationService.getById(location.id);
      expect(retrieved).toBeDefined();

      // Undo
      const result = await historyService.undo(testProjectId);

      expect(result?.success).toBe(true);
      expect(result?.entityType).toBe('location');

      // Verify location is deleted
      retrieved = await locationService.getById(location.id);
      expect(retrieved).toBeNull();
    });

    it('should allow undoing multiple actions', async () => {
      // Create two entities
      const stamp = await stampService.create({
        planId: testPlanId,
        deviceId: testDeviceId,
        position: { x: 100, y: 100, scale: 1 },
      });

      const location = await locationService.createRectangle({
        planId: testPlanId,
        name: 'Test Room',
        bounds: { x: 500, y: 500, width: 100, height: 100 },
      });

      // Verify both exist
      expect(await stampService.getById(stamp.id)).toBeDefined();
      expect(await locationService.getById(location.id)).toBeDefined();

      // First undo - should undo one of them
      const result1 = await historyService.undo(testProjectId);
      expect(result1?.success).toBe(true);

      // Second undo - should undo the other
      const result2 = await historyService.undo(testProjectId);
      expect(result2?.success).toBe(true);

      // Verify both are now deleted
      expect(await stampService.getById(stamp.id)).toBeNull();
      expect(await locationService.getById(location.id)).toBeNull();
    });
  });

  describe('pruneHistory', () => {
    it('should not prune when under limit', async () => {
      // Create 5 stamps
      for (let i = 0; i < 5; i++) {
        await stampService.create({
          planId: testPlanId,
          deviceId: testDeviceId,
          position: { x: i * 10, y: i * 10, scale: 1 },
        });
      }

      const historyBefore = await historyService.getHistory(testProjectId);
      expect(historyBefore.length).toBe(5);

      await historyService.pruneHistory(testProjectId);

      const historyAfter = await historyService.getHistory(testProjectId);
      expect(historyAfter.length).toBe(5);
    });
  });

  describe('revision types', () => {
    it('should record create, update revision types for stamps', async () => {
      // Create stamp - generates 'create' revision
      const stamp = await stampService.create({
        planId: testPlanId,
        deviceId: testDeviceId,
        position: { x: 100, y: 100, scale: 1 },
      });

      // Update stamp - generates 'update' revision
      await stampService.update(stamp.id, {
        position: { x: 200, y: 200, scale: 1 },
      });

      // Check revision types
      const history = await historyService.getHistory(testProjectId);

      // We should have create and update
      const types = history.map((h) => h.type);
      expect(types).toContain('create');
      expect(types).toContain('update');
    });

    it('should record revision types for locations', async () => {
      // Create location
      const location = await locationService.createRectangle({
        planId: testPlanId,
        name: 'Room',
        bounds: { x: 0, y: 0, width: 100, height: 100 },
      });

      // Update location
      await locationService.update(location.id, {
        name: 'Updated Room',
      });

      const history = await historyService.getHistory(testProjectId);

      const types = history.map((h) => h.type);
      expect(types).toContain('create');
      expect(types).toContain('update');
    });
  });

  describe('error handling', () => {
    it('should wrap database errors in ServiceError', async () => {
      // Force a database error by closing the connection
      sqlite.close();

      await expect(historyService.getHistory(testProjectId)).rejects.toThrow(ServiceError);
      await expect(historyService.getHistory(testProjectId)).rejects.toMatchObject({
        code: ServiceErrorCode.DATABASE_ERROR,
      });
    });
  });
});
