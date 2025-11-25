/**
 * Export Service
 * Aggregates project data for export in various formats
 */

import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema.js';
import { ServiceError, ServiceErrorCode } from './types.js';
import { createCountService } from './countService.js';

/**
 * Export row represents a single device count entry
 * Suitable for CSV/JSON export with location context
 */
export interface ExportRow {
  device: string;
  total: number;
  location: string | null;
  quantity: number;
}

/**
 * Export data structure
 */
export interface ExportData {
  projectId: string;
  projectName: string;
  rows: ExportRow[];
  generatedAt: Date;
  includeLocations: boolean;
}

/**
 * Export Service
 * Provides data aggregation for exports
 */
export class ExportService {
  constructor(private db: BetterSQLite3Database<typeof schema>) {}

  /**
   * Get export data for a project
   * Aggregates counts with device/location names
   *
   * @param projectId - Project ID
   * @param includeLocations - Whether to include per-location breakdowns
   * @returns Export data ready for formatting
   */
  async getExportData(projectId: string, includeLocations: boolean): Promise<ExportData> {
    try {
      // Verify project exists
      const project = await this.db
        .select({ id: schema.projects.id, name: schema.projects.name })
        .from(schema.projects)
        .where(eq(schema.projects.id, projectId))
        .limit(1);

      if (project.length === 0) {
        throw new ServiceError(
          ServiceErrorCode.NOT_FOUND,
          `Project ${projectId} not found`,
        );
      }

      const projectData = project[0];
      if (!projectData) {
        throw new ServiceError(
          ServiceErrorCode.NOT_FOUND,
          `Project ${projectId} not found`,
        );
      }

      // Get all plans for this project to aggregate counts
      const plans = await this.db
        .select({ id: schema.plans.id })
        .from(schema.plans)
        .where(eq(schema.plans.projectId, projectId));

      const rows: ExportRow[] = [];

      // Aggregate counts across all plans
      const countService = createCountService(this.db);

      for (const plan of plans) {
        const countsResponse = await countService.getCountsForPlan(plan.id);

        if (includeLocations) {
          // Include per-location breakdowns
          for (const count of countsResponse.counts) {
            rows.push({
              device: count.deviceName,
              total: count.total,
              location: count.locationName,
              quantity: count.total,
            });
          }
        } else {
          // Only include device totals (aggregate across locations)
          for (const total of countsResponse.totals) {
            // Check if device already exists in rows
            const existing = rows.find((r) => r.device === total.deviceName && r.location === null);
            if (existing) {
              existing.total += total.total;
              existing.quantity += total.total;
            } else {
              rows.push({
                device: total.deviceName,
                total: total.total,
                location: null,
                quantity: total.total,
              });
            }
          }
        }
      }

      // Sort rows by device name, then location name
      rows.sort((a, b) => {
        const deviceCompare = a.device.localeCompare(b.device);
        if (deviceCompare !== 0) return deviceCompare;

        // Put null locations first
        if (a.location === null && b.location !== null) return -1;
        if (a.location !== null && b.location === null) return 1;
        if (a.location === null && b.location === null) return 0;

        // Both locations are non-null here, enforce string type for TS
        // eslint-disable-next-line @typescript-eslint/non-nullable-type-assertion-style
        return (a.location as string).localeCompare(b.location as string);
      });

      return {
        projectId: projectData.id,
        projectName: projectData.name,
        rows,
        generatedAt: new Date(),
        includeLocations,
      };
    } catch (error) {
      if (error instanceof ServiceError) {
        throw error;
      }
      throw new ServiceError(
        ServiceErrorCode.DATABASE_ERROR,
        `Failed to aggregate export data for project ${projectId}`,
        error,
      );
    }
  }

  /**
   * Get export data as an async iterator
   * Useful for streaming large datasets
   *
   * @param projectId - Project ID
   * @param includeLocations - Whether to include per-location breakdowns
   * @yields Export rows one at a time
   */
  async *getExportDataStream(
    projectId: string,
    includeLocations: boolean,
  ): AsyncGenerator<ExportRow, void, undefined> {
    // For SQLite, we'll load all data first then yield
    // This could be optimized later with cursor-based pagination
    const data = await this.getExportData(projectId, includeLocations);

    for (const row of data.rows) {
      yield row;
    }
  }
}

/**
 * Factory function to create export service
 *
 * @param db - Database instance
 * @returns Export service instance
 */
export function createExportService(
  db: BetterSQLite3Database<typeof schema>,
): ExportService {
  return new ExportService(db);
}
