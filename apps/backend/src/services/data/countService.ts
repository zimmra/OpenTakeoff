/**
 * Count Service
 * Data access layer for real-time stamp count aggregations
 */

import { eq, and, isNull, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../../db/schema.js';
import { ServiceError, ServiceErrorCode } from './types.js';
import { classifyPoint, type GeometryLocation, type Vertex, type RectangleBounds } from '../../utils/geometry.js';
import type { StampPosition } from './types.js';

/**
 * Count DTO for a specific device and location
 */
export interface DeviceLocationCount {
  deviceId: string;
  deviceName: string;
  locationId: string | null;
  locationName: string | null;
  total: number;
}

/**
 * Aggregated counts response
 */
export interface CountsResponse {
  planId: string;
  counts: DeviceLocationCount[];
  totals: {
    deviceId: string;
    deviceName: string;
    total: number;
  }[];
  updatedAt: Date;
}

/**
 * Count Service
 * Provides efficient read access to materialized count aggregations
 */
export class CountService {
  constructor(private db: BetterSQLite3Database<typeof schema>) {}

  /**
   * Get counts for a specific plan
   * Returns per-device, per-location counts plus device totals
   *
   * @param planId - Plan ID
   * @returns Aggregated counts with totals
   */
  async getCountsForPlan(planId: string): Promise<CountsResponse> {
    try {
      // Query counts with joined device and location names
      const countsQuery = this.db
        .select({
          deviceId: schema.counts.deviceId,
          deviceName: schema.devices.name,
          locationId: schema.counts.locationId,
          locationName: schema.locations.name,
          total: schema.counts.total,
          updatedAt: schema.counts.updatedAt,
        })
        .from(schema.counts)
        .leftJoin(schema.devices, eq(schema.counts.deviceId, schema.devices.id))
        .leftJoin(schema.locations, eq(schema.counts.locationId, schema.locations.id))
        .where(eq(schema.counts.planId, planId))
        .orderBy(schema.devices.name, schema.locations.name);

      const results = await countsQuery;

      // Find most recent update timestamp
      const latestUpdate = results.reduce((latest, row) => {
        return row.updatedAt > latest ? row.updatedAt : latest;
      }, new Date(0));

      // Build per-device per-location counts
      const counts: DeviceLocationCount[] = results.map((row) => ({
        deviceId: row.deviceId,
        deviceName: row.deviceName ?? 'Unknown Device',
        locationId: row.locationId,
        locationName: row.locationName,
        total: row.total,
      }));

      // Aggregate totals per device
      const deviceTotalsMap = new Map<string, { deviceName: string; total: number }>();

      for (const count of counts) {
        const existing = deviceTotalsMap.get(count.deviceId);
        if (existing) {
          existing.total += count.total;
        } else {
          deviceTotalsMap.set(count.deviceId, {
            deviceName: count.deviceName,
            total: count.total,
          });
        }
      }

      const totals = Array.from(deviceTotalsMap.entries()).map(([deviceId, data]) => ({
        deviceId,
        deviceName: data.deviceName,
        total: data.total,
      }));

      return {
        planId,
        counts,
        totals,
        updatedAt: latestUpdate,
      };
    } catch (error) {
      throw new ServiceError(
        ServiceErrorCode.DATABASE_ERROR,
        `Failed to get counts for plan ${planId}`,
        error,
      );
    }
  }

  /**
   * Recompute all counts for a plan
   * Fallback method for heavy updates or data integrity recovery
   *
   * @param planId - Plan ID
   * @returns Number of count rows updated
   */
  async recomputeCountsForPlan(planId: string): Promise<number> {
    try {
      // Step 1: Fix spatial associations (assign stamps to locations)
      
      // Get all locations for the plan
      const locations = await this.db
        .select()
        .from(schema.locations)
        .where(eq(schema.locations.planId, planId));

      // Prepare geometry objects
      const geometries: { id: string; geometry: GeometryLocation }[] = [];
      
      for (const loc of locations) {
        let vertices: Vertex[] = [];
        if (loc.type === 'polygon') {
            // Need to fetch vertices
            const vertexRows = await this.db
              .select()
              .from(schema.locationVertices)
              .where(eq(schema.locationVertices.locationId, loc.id))
              .orderBy(schema.locationVertices.sequence);
            vertices = vertexRows.map((v) => ({ x: v.x, y: v.y }));
        }

        let bounds: RectangleBounds | null = null;
        if (loc.bounds) {
             if (typeof loc.bounds === 'string') {
                try {
                   bounds = JSON.parse(loc.bounds) as RectangleBounds;
                } catch(e) {
                   console.error('Failed to parse bounds JSON:', e);
                }
             } else {
                bounds = loc.bounds as RectangleBounds;
             }
        }

        geometries.push({
            id: loc.id,
            geometry: {
                type: loc.type,
                bounds,
                vertices
            }
        });
      }

      // Get all stamps
      const stamps = await this.db.select().from(schema.stamps).where(eq(schema.stamps.planId, planId));
      
      const updates: { id: string; locationId: string | null }[] = [];

      for (const stamp of stamps) {
        let newLocationId: string | null = null;
        const point = { x: (stamp.position as StampPosition).x, y: (stamp.position as StampPosition).y };
        
        // Find if stamp is inside any location
        // Use classifyPoint to check containment
        for (const geo of geometries) {
            if (classifyPoint(point, geo.geometry)) {
                newLocationId = geo.id;
                break; // Assign to first matching location
            }
        }

        if (stamp.locationId !== newLocationId) {
            updates.push({ id: stamp.id, locationId: newLocationId });
        }
      }

      // Use transaction for atomic recompute
      return this.db.transaction((tx) => {
        // Apply spatial updates
        const now = new Date();
        for (const update of updates) {
            tx.update(schema.stamps)
              .set({ locationId: update.locationId, updatedAt: now })
              .where(eq(schema.stamps.id, update.id))
              .run();
        }

        // Delete existing counts for this plan
        tx.delete(schema.counts).where(eq(schema.counts.planId, planId)).run();

        // Recompute from stamps using direct SQL for performance
        const aggregated = tx
          .select({
            planId: schema.stamps.planId,
            deviceId: schema.stamps.deviceId,
            locationId: schema.stamps.locationId,
            total: sql<number>`count(${schema.stamps.id})`,
          })
          .from(schema.stamps)
          .where(eq(schema.stamps.planId, planId))
          .groupBy(schema.stamps.planId, schema.stamps.deviceId, schema.stamps.locationId)
          .all();

        // Insert new count rows
        if (aggregated.length > 0) {
          tx.insert(schema.counts)
            .values(
              aggregated.map((agg, idx) => ({
                id: `${planId}-${agg.deviceId}-${agg.locationId ?? 'null'}-${idx}`,
                planId: agg.planId,
                deviceId: agg.deviceId,
                locationId: agg.locationId,
                total: Number(agg.total), // Convert BigInt to number
                updatedAt: now,
              })),
            )
            .run();
        }

        return aggregated.length;
      });
    } catch (error) {
      console.error('Detailed recompute error:', error);
      throw new ServiceError(
        ServiceErrorCode.DATABASE_ERROR,
        `Failed to recompute counts for plan ${planId}`,
        error,
      );
    }
  }

  /**
   * Get count for a specific device and location
   *
   * @param planId - Plan ID
   * @param deviceId - Device ID
   * @param locationId - Location ID (null for global count)
   * @returns Count value or 0 if not found
   */
  async getCount(planId: string, deviceId: string, locationId: string | null): Promise<number> {
    try {
      const whereClause = locationId
        ? and(
            eq(schema.counts.planId, planId),
            eq(schema.counts.deviceId, deviceId),
            eq(schema.counts.locationId, locationId),
          )
        : and(
            eq(schema.counts.planId, planId),
            eq(schema.counts.deviceId, deviceId),
            isNull(schema.counts.locationId),
          );

      const results = await this.db
        .select({ total: schema.counts.total })
        .from(schema.counts)
        .where(whereClause)
        .limit(1);

      const firstResult = results[0];
      return firstResult ? firstResult.total : 0;
    } catch (error) {
      throw new ServiceError(
        ServiceErrorCode.DATABASE_ERROR,
        `Failed to get count for device ${deviceId}`,
        error,
      );
    }
  }
}

/**
 * Factory function to create count service
 *
 * @param db - Database instance
 * @returns Count service instance
 */
export function createCountService(db: BetterSQLite3Database<typeof schema>): CountService {
  return new CountService(db);
}
