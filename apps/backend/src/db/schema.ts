/**
 * Database Schema
 * Drizzle ORM schema definitions for OpenTakeOff
 */

import { sqliteTable, text, integer, blob, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/**
 * Projects Table
 * Top-level container for plans and takeoff data
 */
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
});

/**
 * Plans Table
 * PDF floorplans uploaded to a project
 */
export const plans = sqliteTable(
  'plans',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .references(() => projects.id, { onDelete: 'cascade' })
      .notNull(),
    name: text('name').notNull(),
    pageNumber: integer('page_number').notNull(),
    pageCount: integer('page_count').notNull(),
    filePath: text('file_path').notNull(),
    fileSize: integer('file_size').notNull(),
    fileHash: text('file_hash').notNull(),
    width: integer('width'),
    height: integer('height'),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
  },
  (table) => ({
    projectPageIdx: uniqueIndex('plans_project_page_idx').on(table.projectId, table.pageNumber),
    fileHashIdx: index('plans_file_hash_idx').on(table.fileHash),
  }),
);

/**
 * Devices Table
 * Catalog of symbols/devices that can be placed on plans
 */
export const devices = sqliteTable(
  'devices',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .references(() => projects.id, { onDelete: 'cascade' })
      .notNull(),
    name: text('name').notNull(),
    description: text('description'),
    color: text('color'),
    iconKey: text('icon_key'),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
  },
  (table) => ({
    projectNameIdx: uniqueIndex('devices_project_name_idx').on(table.projectId, table.name),
  }),
);

/**
 * Locations Table
 * Rooms/areas defined on plans (rectangles or polygons)
 */
export const locations = sqliteTable(
  'locations',
  {
    id: text('id').primaryKey(),
    planId: text('plan_id')
      .references(() => plans.id, { onDelete: 'cascade' })
      .notNull(),
    name: text('name').notNull(),
    type: text('type', { enum: ['rectangle', 'polygon'] }).notNull(),
    // For rectangles: { x, y, width, height }
    // For polygons: null (use location_vertices instead)
    bounds: blob('bounds', { mode: 'json' }),
    color: text('color'),
    revision: integer('revision').default(0).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
  },
  (table) => ({
    planIdx: index('locations_plan_idx').on(table.planId),
  }),
);

/**
 * Location Vertices Table
 * Polygon vertices for non-rectangular locations
 */
export const locationVertices = sqliteTable(
  'location_vertices',
  {
    id: text('id').primaryKey(),
    locationId: text('location_id')
      .references(() => locations.id, { onDelete: 'cascade' })
      .notNull(),
    sequence: integer('sequence').notNull(),
    x: integer('x').notNull(),
    y: integer('y').notNull(),
  },
  (table) => ({
    locationSeqIdx: uniqueIndex('location_vertices_location_seq_idx').on(
      table.locationId,
      table.sequence,
    ),
  }),
);

/**
 * Location Revisions Table
 * History of location changes
 */
export const locationRevisions = sqliteTable(
  'location_revisions',
  {
    id: text('id').primaryKey(),
    locationId: text('location_id')
      .references(() => locations.id, { onDelete: 'cascade' })
      .notNull(),
    type: text('type', { enum: ['create', 'update', 'delete'] }).notNull(),
    // Snapshot of location data before change
    snapshot: blob('snapshot', { mode: 'json' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
  },
  (table) => ({
    locationCreatedIdx: index('location_revisions_location_created_idx').on(
      table.locationId,
      table.createdAt,
    ),
  }),
);

/**
 * Stamps Table
 * Device placements on plans
 */
export const stamps = sqliteTable(
  'stamps',
  {
    id: text('id').primaryKey(),
    planId: text('plan_id')
      .references(() => plans.id, { onDelete: 'cascade' })
      .notNull(),
    deviceId: text('device_id')
      .references(() => devices.id, { onDelete: 'cascade' })
      .notNull(),
    locationId: text('location_id').references(() => locations.id, { onDelete: 'set null' }),
    // Position: { x, y, scale }
    position: blob('position', { mode: 'json' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
  },
  (table) => ({
    // Composite index for fast aggregation queries
    aggregationIdx: index('stamps_aggregation_idx').on(
      table.planId,
      table.deviceId,
      table.locationId,
    ),
    planIdx: index('stamps_plan_idx').on(table.planId),
    deviceIdx: index('stamps_device_idx').on(table.deviceId),
  }),
);

/**
 * Stamp Revisions Table
 * History of stamp changes for undo/redo functionality
 */
export const stampRevisions = sqliteTable(
  'stamp_revisions',
  {
    id: text('id').primaryKey(),
    stampId: text('stamp_id')
      .references(() => stamps.id, { onDelete: 'cascade' })
      .notNull(),
    type: text('type', { enum: ['create', 'update', 'delete'] }).notNull(),
    // Snapshot of stamp data before change
    snapshot: blob('snapshot', { mode: 'json' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
  },
  (table) => ({
    stampCreatedIdx: index('stamp_revisions_stamp_created_idx').on(table.stampId, table.createdAt),
  }),
);

/**
 * Counts Table
 * Pre-aggregated counts for quick lookup
 */
export const counts = sqliteTable(
  'counts',
  {
    id: text('id').primaryKey(),
    planId: text('plan_id')
      .references(() => plans.id, { onDelete: 'cascade' })
      .notNull(),
    deviceId: text('device_id')
      .references(() => devices.id, { onDelete: 'cascade' })
      .notNull(),
    locationId: text('location_id').references(() => locations.id, { onDelete: 'cascade' }),
    total: integer('total').default(0).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
  },
  (table) => ({
    planDeviceIdx: uniqueIndex('counts_plan_device_location_idx').on(
      table.planId,
      table.deviceId,
      table.locationId,
    ),
  }),
);

/**
 * Exports Table
 * Tracking generated export files (CSV, JSON, PDF)
 */
export const exports = sqliteTable(
  'exports',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .references(() => projects.id, { onDelete: 'cascade' })
      .notNull(),
    format: text('format', { enum: ['csv', 'json', 'pdf'] }).notNull(),
    filePath: text('file_path').notNull(),
    fileSize: integer('file_size').notNull(),
    includeLocations: integer('include_locations', { mode: 'boolean' }).default(false).notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
  },
  (table) => ({
    projectIdx: index('exports_project_idx').on(table.projectId),
    expiresIdx: index('exports_expires_idx').on(table.expiresAt),
  }),
);
