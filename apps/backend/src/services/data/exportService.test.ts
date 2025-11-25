/**
 * Export Service Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '../../db/schema.js';
import { createExportService } from './exportService.js';
import { createProjectService } from './projectService.js';
import { createPlanService } from './planService.js';
import { createDeviceService } from './deviceService.js';
import { createStampService } from './stampService.js';
import { createLocationService } from './locationService.js';
import { ServiceError, ServiceErrorCode } from './types.js';

describe('ExportService', () => {
  let sqlite: Database.Database;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let exportService: ReturnType<typeof createExportService>;
  let projectService: ReturnType<typeof createProjectService>;
  let planService: ReturnType<typeof createPlanService>;
  let deviceService: ReturnType<typeof createDeviceService>;
  let stampService: ReturnType<typeof createStampService>;
  let locationService: ReturnType<typeof createLocationService>;

  beforeEach(() => {
    // Create in-memory database for testing
    sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');

    db = drizzle(sqlite, { schema });

    // Apply migrations
    migrate(db, { migrationsFolder: './drizzle' });

    // Create service instances
    exportService = createExportService(db);
    projectService = createProjectService(db);
    planService = createPlanService(db);
    deviceService = createDeviceService(db);
    stampService = createStampService(db);
    locationService = createLocationService(db);
  });

  afterEach(() => {
    sqlite.close();
  });

  describe('getExportData', () => {
    it('should throw NOT_FOUND for non-existent project', async () => {
      await expect(exportService.getExportData('non-existent', false)).rejects.toThrow(
        ServiceError,
      );

      try {
        await exportService.getExportData('non-existent', false);
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceError);
        expect((error as ServiceError).code).toBe(ServiceErrorCode.NOT_FOUND);
      }
    });

    it('should return empty rows for project with no data', async () => {
      const project = await projectService.create({
        name: 'Empty Project',
        description: 'No plans or devices',
      });

      const data = await exportService.getExportData(project.id, false);

      expect(data.projectId).toBe(project.id);
      expect(data.projectName).toBe('Empty Project');
      expect(data.rows).toEqual([]);
      expect(data.includeLocations).toBe(false);
      expect(data.generatedAt).toBeInstanceOf(Date);
    });

    it('should aggregate device totals without locations', async () => {
      // Create test project
      const project = await projectService.create({
        name: 'Test Project',
      });

      // Create plan
      const plan = await planService.create({
        projectId: project.id,
        name: 'Floor 1',
        pageNumber: 1,
        pageCount: 1,
        filePath: '/test/file.pdf',
        fileSize: 1000,
        fileHash: 'hash123',
        width: 1000,
        height: 800,
      });

      // Create devices
      const device1 = await deviceService.create({
        projectId: project.id,
        name: 'Outlet',
        description: 'Electrical outlet',
      });

      const device2 = await deviceService.create({
        projectId: project.id,
        name: 'Switch',
        description: 'Light switch',
      });

      // Create stamps (no locations)
      await stampService.create({
        planId: plan.id,
        deviceId: device1.id,
        locationId: undefined,
        position: { x: 100, y: 100, scale: 1 },
      });

      await stampService.create({
        planId: plan.id,
        deviceId: device1.id,
        locationId: undefined,
        position: { x: 200, y: 200, scale: 1 },
      });

      await stampService.create({
        planId: plan.id,
        deviceId: device2.id,
        locationId: undefined,
        position: { x: 300, y: 300, scale: 1 },
      });

      // Get export data
      const data = await exportService.getExportData(project.id, false);

      expect(data.rows).toHaveLength(2);
      expect(data.rows[0]).toMatchObject({
        device: 'Outlet',
        total: 2,
        location: null,
        quantity: 2,
      });
      expect(data.rows[1]).toMatchObject({
        device: 'Switch',
        total: 1,
        location: null,
        quantity: 1,
      });
    });

    it('should include per-location breakdowns when requested', async () => {
      // Create test project
      const project = await projectService.create({
        name: 'Test Project',
      });

      // Create plan
      const plan = await planService.create({
        projectId: project.id,
        name: 'Floor 1',
        pageNumber: 1,
        pageCount: 1,
        filePath: '/test/file.pdf',
        fileSize: 1000,
        fileHash: 'hash123',
        width: 1000,
        height: 800,
      });

      // Create device
      const device = await deviceService.create({
        projectId: project.id,
        name: 'Outlet',
      });

      // Create locations
      const location1 = await locationService.createRectangle({
        planId: plan.id,
        name: 'Kitchen',
        bounds: { x: 0, y: 0, width: 500, height: 500 },
        color: '#FF0000',
      });

      const location2 = await locationService.createRectangle({
        planId: plan.id,
        name: 'Bedroom',
        bounds: { x: 500, y: 0, width: 500, height: 500 },
        color: '#00FF00',
      });

      // Create stamps in different locations
      await stampService.create({
        planId: plan.id,
        deviceId: device.id,
        locationId: location1.id,
        position: { x: 100, y: 100, scale: 1 },
      });

      await stampService.create({
        planId: plan.id,
        deviceId: device.id,
        locationId: location1.id,
        position: { x: 200, y: 200, scale: 1 },
      });

      await stampService.create({
        planId: plan.id,
        deviceId: device.id,
        locationId: location2.id,
        position: { x: 600, y: 100, scale: 1 },
      });

      // Get export data with locations
      const data = await exportService.getExportData(project.id, true);

      expect(data.rows).toHaveLength(2);
      expect(data.includeLocations).toBe(true);

      // Rows should be sorted by device, then location
      expect(data.rows[0]).toMatchObject({
        device: 'Outlet',
        location: 'Bedroom',
        quantity: 1,
      });
      expect(data.rows[1]).toMatchObject({
        device: 'Outlet',
        location: 'Kitchen',
        quantity: 2,
      });
    });
  });

  describe('getExportDataStream', () => {
    it('should yield rows one at a time', async () => {
      // Create simple test data
      const project = await projectService.create({ name: 'Stream Test' });
      const plan = await planService.create({
        projectId: project.id,
        name: 'Plan 1',
        pageNumber: 1,
        pageCount: 1,
        filePath: '/test.pdf',
        fileSize: 1000,
        fileHash: 'hash',
      });

      const device = await deviceService.create({ projectId: project.id, name: 'Device A' });

      await stampService.create({
        planId: plan.id,
        deviceId: device.id,
        locationId: undefined,
        position: { x: 0, y: 0, scale: 1 },
      });

      // Collect rows from stream
      const rows = [];
      for await (const row of exportService.getExportDataStream(project.id, false)) {
        rows.push(row);
      }

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        device: 'Device A',
        total: 1,
        location: null,
        quantity: 1,
      });
    });
  });
});
