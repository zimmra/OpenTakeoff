/**
 * Database Schema Tests
 * Validates schema integrity and database connectivity
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import * as schema from './schema.js';

describe('Database Schema', () => {
  let sqlite: Database.Database;
  let db: ReturnType<typeof drizzle>;

  beforeAll(() => {
    // Create in-memory database for testing
    sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');

    db = drizzle(sqlite, { schema });

    // Apply migrations
    migrate(db, { migrationsFolder: './drizzle' });
  });

  afterAll(() => {
    sqlite.close();
  });

  it('should create all tables', () => {
    const tables = sqlite.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations'
      ORDER BY name
    `).all();

    const tableNames = tables.map((t: any) => t.name);

    expect(tableNames).toContain('projects');
    expect(tableNames).toContain('plans');
    expect(tableNames).toContain('devices');
    expect(tableNames).toContain('locations');
    expect(tableNames).toContain('location_vertices');
    expect(tableNames).toContain('stamps');
    expect(tableNames).toContain('stamp_revisions');
    expect(tableNames).toContain('exports');
  });

  it('should enforce foreign key constraints', () => {
    const foreignKeys = sqlite.pragma('foreign_keys');
    expect(foreignKeys).toEqual([{ foreign_keys: 1 }]);
  });

  it('should have correct indexes on plans table', () => {
    const indexes = sqlite.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='index' AND tbl_name='plans' AND name NOT LIKE 'sqlite_%'
    `).all();

    const indexNames = indexes.map((i: any) => i.name);

    expect(indexNames).toContain('plans_project_page_idx');
    expect(indexNames).toContain('plans_file_hash_idx');
  });

  it('should have correct indexes on stamps table', () => {
    const indexes = sqlite.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='index' AND tbl_name='stamps' AND name NOT LIKE 'sqlite_%'
    `).all();

    const indexNames = indexes.map((i: any) => i.name);

    expect(indexNames).toContain('stamps_aggregation_idx');
    expect(indexNames).toContain('stamps_plan_idx');
    expect(indexNames).toContain('stamps_device_idx');
  });

  it('should enforce cascade deletes on projects', () => {
    // Insert test project
    const projectId = 'test-project-1';
    db.insert(schema.projects).values({
      id: projectId,
      name: 'Test Project',
      createdAt: new Date(),
      updatedAt: new Date(),
    }).run();

    // Insert related plan
    const planId = 'test-plan-1';
    db.insert(schema.plans).values({
      id: planId,
      projectId,
      name: 'Test Plan',
      pageNumber: 1,
      pageCount: 1,
      filePath: '/test/path.pdf',
      fileSize: 1000,
      fileHash: 'abc123',
      createdAt: new Date(),
      updatedAt: new Date(),
    }).run();

    // Delete project
    db.delete(schema.projects).where(eq(schema.projects.id, projectId)).run();

    // Check that plan was also deleted
    const remainingPlans = db.select().from(schema.plans).where(eq(schema.plans.id, planId)).all();
    expect(remainingPlans).toHaveLength(0);
  });

  it('should allow nullable location_id in stamps', () => {
    // Insert test data
    const projectId = 'test-project-2';
    const planId = 'test-plan-2';
    const deviceId = 'test-device-1';
    const stampId = 'test-stamp-1';

    db.insert(schema.projects).values({
      id: projectId,
      name: 'Test Project 2',
      createdAt: new Date(),
      updatedAt: new Date(),
    }).run();

    db.insert(schema.plans).values({
      id: planId,
      projectId,
      name: 'Test Plan 2',
      pageNumber: 1,
      pageCount: 1,
      filePath: '/test/path2.pdf',
      fileSize: 1000,
      fileHash: 'def456',
      createdAt: new Date(),
      updatedAt: new Date(),
    }).run();

    db.insert(schema.devices).values({
      id: deviceId,
      projectId,
      name: 'Test Device',
      createdAt: new Date(),
      updatedAt: new Date(),
    }).run();

    // Insert stamp without location_id
    db.insert(schema.stamps).values({
      id: stampId,
      planId,
      deviceId,
      locationId: null,
      position: { x: 100, y: 200, scale: 1 },
      createdAt: new Date(),
      updatedAt: new Date(),
    }).run();

    const stamp = db.select().from(schema.stamps).where(eq(schema.stamps.id, stampId)).get();
    expect(stamp).toBeDefined();
    expect(stamp?.locationId).toBeNull();
  });
});
