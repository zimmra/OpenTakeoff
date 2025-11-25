/**
 * Location Routes Integration Tests
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema.js';
import { locationRoutes } from './locations.js';

// Mock the database client module - use a factory function
const mockGetDatabase = vi.fn();

vi.mock('../db/client.js', () => ({
  getDatabase: (...args: any[]) => mockGetDatabase(...args),
}));

describe('Location Routes', () => {
  let server: FastifyInstance;
  let projectId: string;
  let planId: string;
  let testDb: ReturnType<typeof drizzle>;
  let testSqlite: Database.Database;

  beforeAll(() => {
    // Create in-memory database for all tests
    testSqlite = new Database(':memory:');
    testSqlite.pragma('foreign_keys = ON');

    testDb = drizzle(testSqlite, { schema });

    // Configure the mock to return our test database
    mockGetDatabase.mockResolvedValue({ db: testDb, sqlite: testSqlite });

    // Create schema tables manually using raw SQL
    testSqlite.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS plans (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        page_number INTEGER NOT NULL,
        page_count INTEGER NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        file_hash TEXT NOT NULL,
        width INTEGER,
        height INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        color TEXT,
        icon_key TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS locations (
        id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('rectangle', 'polygon')),
        bounds TEXT,
        color TEXT,
        revision INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS location_vertices (
        id TEXT PRIMARY KEY,
        location_id TEXT NOT NULL,
        sequence INTEGER NOT NULL,
        x INTEGER NOT NULL,
        y INTEGER NOT NULL,
        FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE,
        UNIQUE(location_id, sequence)
      );

      CREATE TABLE IF NOT EXISTS stamps (
        id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        location_id TEXT,
        position TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE,
        FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
        FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS counts (
        id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        location_id TEXT,
        total INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE,
        FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
        FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS location_revisions (
        id TEXT PRIMARY KEY,
        location_id TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('create', 'update', 'delete')),
        snapshot TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
      );
      
      CREATE TABLE IF NOT EXISTS stamp_revisions (
        id TEXT PRIMARY KEY,
        stamp_id TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('create', 'update', 'delete')),
        snapshot TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (stamp_id) REFERENCES stamps(id) ON DELETE CASCADE
      );
    `);
  });

  beforeEach(async () => {
    // Clear all data before each test
    testDb.delete(schema.stampRevisions).run();
    testDb.delete(schema.stamps).run();
    testDb.delete(schema.locationVertices).run();
    testDb.delete(schema.locationRevisions).run();
    testDb.delete(schema.locations).run();
    testDb.delete(schema.devices).run();
    testDb.delete(schema.counts).run();
    testDb.delete(schema.plans).run();
    testDb.delete(schema.projects).run();

    // Create minimal Fastify instance for testing
    server = Fastify({ logger: false });
    await server.register(locationRoutes);
    await server.ready();

    // Create test project and plan directly in database
    const projectResult = await testDb
      .insert(schema.projects)
      .values({
        id: 'test-project-id',
        name: 'Test Project',
        description: 'Test',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    const insertedProject = projectResult[0];
    if (!insertedProject) throw new Error('Failed to insert test project');
    projectId = insertedProject.id;

    const planResult = await testDb
      .insert(schema.plans)
      .values({
        id: 'test-plan-id',
        projectId,
        name: 'Test Plan',
        pageNumber: 1,
        pageCount: 1,
        filePath: '/test/path.pdf',
        fileSize: 1000,
        fileHash: 'test-hash',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    const insertedPlan = planResult[0];
    if (!insertedPlan) throw new Error('Failed to insert test plan');
    planId = insertedPlan.id;
  });

  afterAll(async () => {
    await server.close();
    testSqlite.close();
  });

  describe('POST /plans/:planId/locations/rectangle', () => {
    it('should create a rectangle location', async () => {
      const response = await server.inject({
        method: 'POST',
        url: `/plans/${planId}/locations/rectangle`,
        payload: {
          name: 'Room A',
          bounds: { x: 0, y: 0, width: 100, height: 100 },
          color: '#FF0000',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        planId,
        name: 'Room A',
        type: 'rectangle',
        bounds: { x: 0, y: 0, width: 100, height: 100 },
        color: '#FF0000',
        revision: 0,
      });
      expect(body.id).toBeDefined();
    });

    it('should reject rectangle with invalid bounds', async () => {
      const response = await server.inject({
        method: 'POST',
        url: `/plans/${planId}/locations/rectangle`,
        payload: {
          name: 'Invalid Room',
          bounds: { x: 0, y: 0, width: 0, height: 100 },
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      // Zod validation catches positive number constraint before custom validation
      expect(body.error).toBe('Invalid request body');
    });

    it('should reject rectangle with area too small', async () => {
      const response = await server.inject({
        method: 'POST',
        url: `/plans/${planId}/locations/rectangle`,
        payload: {
          name: 'Tiny Room',
          bounds: { x: 0, y: 0, width: 0.1, height: 0.1 },
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Rectangle area is too small (must be > 1 square unit)');
    });
  });

  describe('POST /plans/:planId/locations/polygon', () => {
    it('should create a polygon location', async () => {
      const response = await server.inject({
        method: 'POST',
        url: `/plans/${planId}/locations/polygon`,
        payload: {
          name: 'Irregular Area',
          vertices: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 },
            { x: 0, y: 100 },
          ],
          color: '#00FF00',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        planId,
        name: 'Irregular Area',
        type: 'polygon',
        color: '#00FF00',
        revision: 0,
      });
      expect(body.vertices).toHaveLength(4);
    });

    it('should auto-close polygon by removing duplicate endpoint', async () => {
      const response = await server.inject({
        method: 'POST',
        url: `/plans/${planId}/locations/polygon`,
        payload: {
          name: 'Closed Polygon',
          vertices: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 },
            { x: 0, y: 0 }, // Duplicate endpoint
          ],
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.vertices).toHaveLength(3); // Duplicate removed
    });

    it('should reject polygon with less than 3 vertices', async () => {
      const response = await server.inject({
        method: 'POST',
        url: `/plans/${planId}/locations/polygon`,
        payload: {
          name: 'Invalid Polygon',
          vertices: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
          ],
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBeDefined();
    });

    it('should reject polygon with duplicate vertices', async () => {
      const response = await server.inject({
        method: 'POST',
        url: `/plans/${planId}/locations/polygon`,
        payload: {
          name: 'Degenerate Polygon',
          vertices: [
            { x: 0, y: 0 },
            { x: 0, y: 0 },
            { x: 0, y: 0 },
          ],
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      // Custom geometry validation runs after Zod, so this should work
      expect(body.error).toBe('Polygon must have at least 3 unique vertices');
    });
  });

  describe('GET /plans/:planId/locations', () => {
    it('should list all locations for a plan', async () => {
      // Create rectangle
      await server.inject({
        method: 'POST',
        url: `/plans/${planId}/locations/rectangle`,
        payload: {
          name: 'Room 1',
          bounds: { x: 0, y: 0, width: 100, height: 100 },
        },
      });

      // Create polygon
      await server.inject({
        method: 'POST',
        url: `/plans/${planId}/locations/polygon`,
        payload: {
          name: 'Area 1',
          vertices: [
            { x: 200, y: 0 },
            { x: 300, y: 0 },
            { x: 250, y: 100 },
          ],
        },
      });

      // List locations
      const response = await server.inject({
        method: 'GET',
        url: `/plans/${planId}/locations`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveLength(2);
      expect(body[0]).toMatchObject({ name: 'Room 1', type: 'rectangle' });
      expect(body[1]).toMatchObject({ name: 'Area 1', type: 'polygon' });
    });

    it('should return empty array for plan with no locations', async () => {
      const response = await server.inject({
        method: 'GET',
        url: `/plans/${planId}/locations`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual([]);
    });
  });

  describe('GET /plans/:planId/locations/:locationId', () => {
    it('should get a location by ID', async () => {
      // Create location
      const createResponse = await server.inject({
        method: 'POST',
        url: `/plans/${planId}/locations/rectangle`,
        payload: {
          name: 'Test Room',
          bounds: { x: 0, y: 0, width: 100, height: 100 },
        },
      });
      const { id: locationId } = JSON.parse(createResponse.body);

      // Get location
      const response = await server.inject({
        method: 'GET',
        url: `/plans/${planId}/locations/${locationId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        id: locationId,
        name: 'Test Room',
        type: 'rectangle',
      });
    });

    it('should return 404 for non-existent location', async () => {
      const response = await server.inject({
        method: 'GET',
        url: `/plans/${planId}/locations/non-existent-id`,
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('PATCH /plans/:planId/locations/:locationId', () => {
    it('should update a rectangle location', async () => {
      // Create location
      const createResponse = await server.inject({
        method: 'POST',
        url: `/plans/${planId}/locations/rectangle`,
        payload: {
          name: 'Old Name',
          bounds: { x: 0, y: 0, width: 100, height: 100 },
        },
      });
      const { id: locationId } = JSON.parse(createResponse.body);

      // Update location
      const response = await server.inject({
        method: 'PATCH',
        url: `/plans/${planId}/locations/${locationId}`,
        payload: {
          name: 'New Name',
          bounds: { x: 10, y: 10, width: 200, height: 200 },
          color: '#0000FF',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        id: locationId,
        name: 'New Name',
        bounds: { x: 10, y: 10, width: 200, height: 200 },
        color: '#0000FF',
        revision: 1, // Revision incremented
      });
    });

    it('should update a polygon location vertices', async () => {
      // Create polygon
      const createResponse = await server.inject({
        method: 'POST',
        url: `/plans/${planId}/locations/polygon`,
        payload: {
          name: 'Polygon',
          vertices: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 50, y: 100 },
          ],
        },
      });
      const { id: locationId } = JSON.parse(createResponse.body);

      // Update vertices
      const response = await server.inject({
        method: 'PATCH',
        url: `/plans/${planId}/locations/${locationId}`,
        payload: {
          vertices: [
            { x: 0, y: 0 },
            { x: 150, y: 0 },
            { x: 150, y: 150 },
            { x: 0, y: 150 },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.vertices).toHaveLength(4);
      expect(body.revision).toBe(1);
    });

    it('should return 404 for non-existent location', async () => {
      const response = await server.inject({
        method: 'PATCH',
        url: `/plans/${planId}/locations/non-existent-id`,
        payload: {
          name: 'New Name',
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('DELETE /plans/:planId/locations/:locationId', () => {
    it('should delete a location', async () => {
      // Create location
      const createResponse = await server.inject({
        method: 'POST',
        url: `/plans/${planId}/locations/rectangle`,
        payload: {
          name: 'To Delete',
          bounds: { x: 0, y: 0, width: 100, height: 100 },
        },
      });
      const { id: locationId } = JSON.parse(createResponse.body);

      // Delete location
      const response = await server.inject({
        method: 'DELETE',
        url: `/plans/${planId}/locations/${locationId}`,
      });

      expect(response.statusCode).toBe(204);

      // Verify deletion
      const getResponse = await server.inject({
        method: 'GET',
        url: `/plans/${planId}/locations/${locationId}`,
      });
      expect(getResponse.statusCode).toBe(404);
    });

    it('should cascade delete vertices for polygon', async () => {
      // Create polygon
      const createResponse = await server.inject({
        method: 'POST',
        url: `/plans/${planId}/locations/polygon`,
        payload: {
          name: 'Polygon to Delete',
          vertices: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 50, y: 100 },
          ],
        },
      });
      const { id: locationId } = JSON.parse(createResponse.body);

      // Delete location
      const response = await server.inject({
        method: 'DELETE',
        url: `/plans/${planId}/locations/${locationId}`,
      });

      expect(response.statusCode).toBe(204);

      // Verify vertices are deleted (implicit via cascade)
      const { eq } = await import('drizzle-orm');
      const vertices = await testDb
        .select()
        .from(schema.locationVertices)
        .where(eq(schema.locationVertices.locationId, locationId));

      expect(vertices).toHaveLength(0);
    });

    it('should return 404 for non-existent location', async () => {
      const response = await server.inject({
        method: 'DELETE',
        url: `/plans/${planId}/locations/non-existent-id`,
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('Integration: Revision Tracking', () => {
    it('should track revisions on create, update, delete', async () => {
      // Create
      const createResponse = await server.inject({
        method: 'POST',
        url: `/plans/${planId}/locations/rectangle`,
        payload: {
          name: 'Revision Test',
          bounds: { x: 0, y: 0, width: 100, height: 100 },
        },
      });
      const { id: locationId } = JSON.parse(createResponse.body);
      expect(JSON.parse(createResponse.body).revision).toBe(0);

      // Update 1
      const update1Response = await server.inject({
        method: 'PATCH',
        url: `/plans/${planId}/locations/${locationId}`,
        payload: { name: 'Updated Once' },
      });
      expect(JSON.parse(update1Response.body).revision).toBe(1);

      // Update 2
      const update2Response = await server.inject({
        method: 'PATCH',
        url: `/plans/${planId}/locations/${locationId}`,
        payload: { name: 'Updated Twice' },
      });
      expect(JSON.parse(update2Response.body).revision).toBe(2);

      // Verify revision entries exist
      const { eq } = await import('drizzle-orm');
      const revisions = await testDb
        .select()
        .from(schema.locationRevisions)
        .where(eq(schema.locationRevisions.locationId, locationId));

      expect(revisions.length).toBeGreaterThanOrEqual(3); // create, update1, update2
    });
  });
});
