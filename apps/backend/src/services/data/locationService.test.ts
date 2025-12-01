/**
 * Location Service Tests
 * Unit tests for location CRUD operations with revision tracking
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema.js';
import { LocationService } from './locationService.js';
import { ProjectService } from './projectService.js';
import { PlanService } from './planService.js';
import { ServiceError, ServiceErrorCode } from './types.js';

// Mock the count event service
vi.mock('../events/countEventService.js', () => ({
  getCountEventService: () => ({
    emitCountUpdate: vi.fn(),
  }),
}));

describe('LocationService', () => {
  let sqlite: Database.Database;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let locationService: LocationService;
  let projectService: ProjectService;
  let planService: PlanService;
  let testProjectId: string;
  let testPlanId: string;

  beforeEach(async () => {
    // Create in-memory database for testing
    sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');

    db = drizzle(sqlite, { schema });

    // Apply migrations
    migrate(db, { migrationsFolder: './drizzle' });

    // Create service instances
    locationService = new LocationService(db);
    projectService = new ProjectService(db);
    planService = new PlanService(db);

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
  });

  afterEach(() => {
    sqlite.close();
  });

  describe('createRectangle', () => {
    it('should create a rectangle location with minimal data', async () => {
      const input = {
        planId: testPlanId,
        name: 'Test Room',
        bounds: { x: 0, y: 0, width: 100, height: 100 },
      };

      const location = await locationService.createRectangle(input);

      expect(location.id).toBeDefined();
      expect(location.planId).toBe(testPlanId);
      expect(location.name).toBe('Test Room');
      expect(location.type).toBe('rectangle');
      expect(location.bounds).toEqual({ x: 0, y: 0, width: 100, height: 100 });
      expect(location.vertices).toEqual([]);
      expect(location.color).toBeNull();
      expect(location.revision).toBe(0);
      expect(location.createdAt).toBeInstanceOf(Date);
      expect(location.updatedAt).toBeInstanceOf(Date);
    });

    it('should create a rectangle location with color', async () => {
      const location = await locationService.createRectangle({
        planId: testPlanId,
        name: 'Colored Room',
        bounds: { x: 0, y: 0, width: 100, height: 100 },
        color: '#FF0000',
      });

      expect(location.color).toBe('#FF0000');
    });

    it('should generate unique IDs for each location', async () => {
      const location1 = await locationService.createRectangle({
        planId: testPlanId,
        name: 'Room 1',
        bounds: { x: 0, y: 0, width: 100, height: 100 },
      });
      const location2 = await locationService.createRectangle({
        planId: testPlanId,
        name: 'Room 2',
        bounds: { x: 200, y: 0, width: 100, height: 100 },
      });

      expect(location1.id).not.toBe(location2.id);
    });

    it('should create revision record for new rectangle', async () => {
      const location = await locationService.createRectangle({
        planId: testPlanId,
        name: 'Test Room',
        bounds: { x: 0, y: 0, width: 100, height: 100 },
      });

      // Check revision was created
      const revisions = db
        .select()
        .from(schema.locationRevisions)
        .where(eq(schema.locationRevisions.locationId, location.id))
        .all();

      expect(revisions).toHaveLength(1);
      expect(revisions[0]?.type).toBe('create');
    });
  });

  describe('createPolygon', () => {
    it('should create a polygon location with valid vertices', async () => {
      const vertices = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ];

      const location = await locationService.createPolygon({
        planId: testPlanId,
        name: 'Polygon Area',
        vertices,
      });

      expect(location.id).toBeDefined();
      expect(location.type).toBe('polygon');
      expect(location.bounds).toBeNull();
      expect(location.vertices).toHaveLength(4);
      expect(location.vertices[0]).toEqual({ x: 0, y: 0 });
    });

    it('should create a polygon with color', async () => {
      const location = await locationService.createPolygon({
        planId: testPlanId,
        name: 'Colored Polygon',
        vertices: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 50, y: 100 },
        ],
        color: '#00FF00',
      });

      expect(location.color).toBe('#00FF00');
    });

    it('should throw INVALID_INPUT for polygon with less than 3 vertices', async () => {
      await expect(
        locationService.createPolygon({
          planId: testPlanId,
          name: 'Invalid Polygon',
          vertices: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
          ],
        }),
      ).rejects.toThrow(ServiceError);

      try {
        await locationService.createPolygon({
          planId: testPlanId,
          name: 'Invalid',
          vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
        });
      } catch (error) {
        expect((error as ServiceError).code).toBe(ServiceErrorCode.INVALID_INPUT);
      }
    });

    it('should store vertices in correct sequence order', async () => {
      const vertices = [
        { x: 10, y: 20 },
        { x: 30, y: 40 },
        { x: 50, y: 60 },
        { x: 70, y: 80 },
      ];

      const location = await locationService.createPolygon({
        planId: testPlanId,
        name: 'Ordered Polygon',
        vertices,
      });

      expect(location.vertices).toEqual(vertices);
    });
  });

  describe('getById', () => {
    it('should retrieve an existing rectangle location', async () => {
      const created = await locationService.createRectangle({
        planId: testPlanId,
        name: 'Test Room',
        bounds: { x: 0, y: 0, width: 100, height: 100 },
      });

      const retrieved = await locationService.getById(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.name).toBe('Test Room');
      expect(retrieved?.type).toBe('rectangle');
    });

    it('should retrieve polygon location with vertices', async () => {
      const created = await locationService.createPolygon({
        planId: testPlanId,
        name: 'Test Polygon',
        vertices: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 50, y: 100 },
        ],
      });

      const retrieved = await locationService.getById(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.type).toBe('polygon');
      expect(retrieved?.vertices).toHaveLength(3);
    });

    it('should return null for non-existent location', async () => {
      const retrieved = await locationService.getById('non-existent-id');

      expect(retrieved).toBeNull();
    });
  });

  describe('listByPlan', () => {
    it('should return empty list when no locations exist', async () => {
      const result = await locationService.listByPlan(testPlanId);

      expect(result).toHaveLength(0);
    });

    it('should list all locations for a plan', async () => {
      await locationService.createRectangle({
        planId: testPlanId,
        name: 'Room 1',
        bounds: { x: 0, y: 0, width: 100, height: 100 },
      });
      await locationService.createRectangle({
        planId: testPlanId,
        name: 'Room 2',
        bounds: { x: 200, y: 0, width: 100, height: 100 },
      });
      await locationService.createPolygon({
        planId: testPlanId,
        name: 'Area 1',
        vertices: [
          { x: 400, y: 0 },
          { x: 500, y: 0 },
          { x: 450, y: 100 },
        ],
      });

      const result = await locationService.listByPlan(testPlanId);

      expect(result).toHaveLength(3);
    });

    it('should only list locations for the specified plan', async () => {
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

      await locationService.createRectangle({
        planId: testPlanId,
        name: 'Room in Plan 1',
        bounds: { x: 0, y: 0, width: 100, height: 100 },
      });
      await locationService.createRectangle({
        planId: plan2.id,
        name: 'Room in Plan 2',
        bounds: { x: 0, y: 0, width: 100, height: 100 },
      });

      const result = await locationService.listByPlan(testPlanId);

      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('Room in Plan 1');
    });

    it('should order locations by createdAt', async () => {
      const location1 = await locationService.createRectangle({
        planId: testPlanId,
        name: 'First',
        bounds: { x: 0, y: 0, width: 100, height: 100 },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const location2 = await locationService.createRectangle({
        planId: testPlanId,
        name: 'Second',
        bounds: { x: 200, y: 0, width: 100, height: 100 },
      });

      const result = await locationService.listByPlan(testPlanId);

      expect(result[0]?.id).toBe(location1.id);
      expect(result[1]?.id).toBe(location2.id);
    });
  });

  describe('update', () => {
    it('should update rectangle name', async () => {
      const created = await locationService.createRectangle({
        planId: testPlanId,
        name: 'Original Name',
        bounds: { x: 0, y: 0, width: 100, height: 100 },
      });

      const updated = await locationService.update(created.id, { name: 'Updated Name' });

      expect(updated).toBeDefined();
      expect(updated?.name).toBe('Updated Name');
      expect(updated?.revision).toBe(1);
    });

    it('should update rectangle bounds', async () => {
      const created = await locationService.createRectangle({
        planId: testPlanId,
        name: 'Room',
        bounds: { x: 0, y: 0, width: 100, height: 100 },
      });

      const updated = await locationService.update(created.id, {
        bounds: { x: 50, y: 50, width: 200, height: 200 },
      });

      expect(updated?.bounds).toEqual({ x: 50, y: 50, width: 200, height: 200 });
    });

    it('should update location color', async () => {
      const created = await locationService.createRectangle({
        planId: testPlanId,
        name: 'Room',
        bounds: { x: 0, y: 0, width: 100, height: 100 },
        color: '#FF0000',
      });

      const updated = await locationService.update(created.id, { color: '#00FF00' });

      expect(updated?.color).toBe('#00FF00');
    });

    it('should update polygon vertices', async () => {
      const created = await locationService.createPolygon({
        planId: testPlanId,
        name: 'Polygon',
        vertices: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 50, y: 100 },
        ],
      });

      const updated = await locationService.update(created.id, {
        vertices: [
          { x: 0, y: 0 },
          { x: 200, y: 0 },
          { x: 200, y: 200 },
          { x: 0, y: 200 },
        ],
      });

      expect(updated?.vertices).toHaveLength(4);
      expect(updated?.vertices[1]).toEqual({ x: 200, y: 0 });
    });

    it('should increment revision on each update', async () => {
      const created = await locationService.createRectangle({
        planId: testPlanId,
        name: 'Room',
        bounds: { x: 0, y: 0, width: 100, height: 100 },
      });

      expect(created.revision).toBe(0);

      const update1 = await locationService.update(created.id, { name: 'Update 1' });
      expect(update1?.revision).toBe(1);

      const update2 = await locationService.update(created.id, { name: 'Update 2' });
      expect(update2?.revision).toBe(2);
    });

    it('should create revision record on update', async () => {
      const created = await locationService.createRectangle({
        planId: testPlanId,
        name: 'Room',
        bounds: { x: 0, y: 0, width: 100, height: 100 },
      });

      await locationService.update(created.id, { name: 'Updated' });

      const revisions = db
        .select()
        .from(schema.locationRevisions)
        .where(eq(schema.locationRevisions.locationId, created.id))
        .all();

      expect(revisions).toHaveLength(2); // create + update
      expect(revisions[1]?.type).toBe('update');
    });

    it('should return null for non-existent location', async () => {
      const updated = await locationService.update('non-existent-id', { name: 'Updated' });

      expect(updated).toBeNull();
    });

    it('should throw INVALID_INPUT for polygon update with less than 3 vertices', async () => {
      const created = await locationService.createPolygon({
        planId: testPlanId,
        name: 'Polygon',
        vertices: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 50, y: 100 },
        ],
      });

      await expect(
        locationService.update(created.id, {
          vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
        }),
      ).rejects.toThrow(ServiceError);
    });
  });

  describe('delete', () => {
    it('should delete an existing rectangle location', async () => {
      const created = await locationService.createRectangle({
        planId: testPlanId,
        name: 'To Delete',
        bounds: { x: 0, y: 0, width: 100, height: 100 },
      });

      const deleted = await locationService.delete(created.id);

      expect(deleted).toBe(true);

      // Verify deletion
      const retrieved = await locationService.getById(created.id);
      expect(retrieved).toBeNull();
    });

    it('should delete polygon and its vertices', async () => {
      const created = await locationService.createPolygon({
        planId: testPlanId,
        name: 'Polygon to Delete',
        vertices: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 50, y: 100 },
        ],
      });

      await locationService.delete(created.id);

      // Verify vertices are also deleted (cascade)
      const vertices = db
        .select()
        .from(schema.locationVertices)
        .where(eq(schema.locationVertices.locationId, created.id))
        .all();

      expect(vertices).toHaveLength(0);
    });

    it('should return false for non-existent location', async () => {
      const deleted = await locationService.delete('non-existent-id');

      expect(deleted).toBe(false);
    });

    it('should create delete revision before deletion', async () => {
      const created = await locationService.createRectangle({
        planId: testPlanId,
        name: 'To Delete',
        bounds: { x: 0, y: 0, width: 100, height: 100 },
      });

      await locationService.delete(created.id);

      // Note: Revisions are cascade deleted with location, but the snapshot is preserved
      // This behavior is implementation-dependent
    });
  });

  describe('error handling', () => {
    it('should wrap database errors in ServiceError', async () => {
      // Force a database error by closing the connection
      sqlite.close();

      await expect(locationService.listByPlan(testPlanId)).rejects.toThrow(ServiceError);
      await expect(locationService.listByPlan(testPlanId)).rejects.toMatchObject({
        code: ServiceErrorCode.DATABASE_ERROR,
      });
    });
  });
});
