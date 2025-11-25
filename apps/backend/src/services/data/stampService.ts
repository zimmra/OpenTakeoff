/**
 * Stamp Service
 * Data layer for stamp CRUD operations with transaction support
 */

import { eq, and, gt, isNull, inArray } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../../db/schema.js';
import type {
  StampDTO,
  StampPosition,
  CreateStampInput,
  UpdateStampInput,
  StampRevisionDTO,
  PaginationParams,
  PaginatedResponse,
} from './types.js';
import { ServiceError, ServiceErrorCode, OptimisticLockError } from './types.js';
import { getCountEventService } from '../events/countEventService.js';
import { classifyPoint, type GeometryLocation, type Vertex } from '../../utils/geometry.js';

/**
 * Default pagination limit
 */
const DEFAULT_LIMIT = 50;

/**
 * Maximum pagination limit
 */
const MAX_LIMIT = 100;

/**
 * Stamp Service
 * Encapsulates all stamp data access logic with transactional support
 */
export class StampService {
  constructor(private db: BetterSQLite3Database<typeof schema>) {}

  /**
   * Emit count update event for a stamp operation
   * Reads the updated count from database and broadcasts
   */
  private async emitCountEvent(planId: string, deviceId: string, locationId: string | null): Promise<void> {
    try {
      // Query the updated count from counts table
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
      const total = firstResult ? firstResult.total : 0;

      // Emit event
      const eventService = getCountEventService();
      eventService.emitCountUpdate({
        planId,
        deviceId,
        locationId,
        total,
        timestamp: new Date(),
      });
    } catch (error) {
      // Log error but don't fail the operation
      console.error('Failed to emit count event:', error);
    }
  }

  /**
   * List stamps for a plan with pagination
   *
   * @param planId - Plan ID
   * @param params - Pagination parameters
   * @returns Paginated list of stamps
   */
  async listByPlan(
    planId: string,
    params: PaginationParams = {},
  ): Promise<PaginatedResponse<StampDTO>> {
    const limit = Math.min(params.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const cursor = params.cursor;

    try {
      // Build where clause
      const whereClause = cursor
        ? and(
            eq(schema.stamps.planId, planId),
            gt(schema.stamps.id, cursor),
          )
        : eq(schema.stamps.planId, planId);

      // Build query with consistent ordering by id
      const query = this.db
        .select()
        .from(schema.stamps)
        .where(whereClause)
        .orderBy(schema.stamps.id)
        .limit(limit + 1); // Fetch one extra to determine hasMore

      const results = await query;

      // Determine if there are more items
      const hasMore = results.length > limit;
      const items = hasMore ? results.slice(0, limit) : results;

      // Get next cursor
      const lastItem = items[items.length - 1];
      const nextCursor = hasMore && lastItem ? lastItem.id : null;

      return {
        items: items.map((item) => this.toDTO(item)),
        pagination: {
          count: items.length,
          nextCursor,
          hasMore,
        },
      };
    } catch (error) {
      throw new ServiceError(
        ServiceErrorCode.DATABASE_ERROR,
        `Failed to list stamps for plan ${planId}`,
        error,
      );
    }
  }

  /**
   * Get a stamp by ID
   *
   * @param id - Stamp ID
   * @returns Stamp DTO or null if not found
   */
  async getById(id: string): Promise<StampDTO | null> {
    try {
      const results = await this.db
        .select()
        .from(schema.stamps)
        .where(eq(schema.stamps.id, id))
        .limit(1);

      const stamp = results[0];
      if (!stamp) {
        return null;
      }

      return this.toDTO(stamp);
    } catch (error) {
      throw new ServiceError(
        ServiceErrorCode.DATABASE_ERROR,
        `Failed to get stamp ${id}`,
        error,
      );
    }
  }

  /**
   * Create a new stamp with revision tracking (transactional)
   *
   * @param input - Stamp creation data
   * @returns Created stamp DTO
   * @throws ServiceError if plan or device doesn't exist
   */
  async create(input: CreateStampInput): Promise<StampDTO> {
    const id = randomUUID();
    const revisionId = randomUUID();
    const now = new Date();

    try {
      // Resolve location if not provided
      let locationId = input.locationId;

      // Fetch all locations for the plan if no locationId is provided
      // This allows backend to assign location based on geometry
      if (!locationId) {
        const locations = await this.db
          .select()
          .from(schema.locations)
          .where(eq(schema.locations.planId, input.planId));

        for (const loc of locations) {
          // Load vertices for polygon locations
          let vertices: Vertex[] = [];
          if (loc.type === 'polygon') {
            const vertexRows = await this.db
              .select()
              .from(schema.locationVertices)
              .where(eq(schema.locationVertices.locationId, loc.id))
              .orderBy(schema.locationVertices.sequence);
            vertices = vertexRows.map((v) => ({ x: v.x, y: v.y }));
          }

          // Parse bounds
          let bounds: { x: number; y: number; width: number; height: number } | null = null;
          if (loc.bounds && typeof loc.bounds === 'string') {
            try {
              bounds = JSON.parse(loc.bounds) as { x: number; y: number; width: number; height: number };
            } catch (e) {
              console.error('Failed to parse bounds JSON:', e);
            }
          } else if (loc.bounds) {
            bounds = loc.bounds as { x: number; y: number; width: number; height: number };
          }

          const geometryLocation: GeometryLocation = {
            type: loc.type,
            bounds: bounds,
            vertices: vertices,
          };

          if (classifyPoint({ x: input.position.x, y: input.position.y }, geometryLocation)) {
            locationId = loc.id;
            break; // Assign to the first matching location (could prioritize z-index later)
          }
        }
      }

      // Execute in transaction to ensure stamp and revision are created atomically
      const result = this.db.transaction((tx) => {
        // Create the stamp
        const stampResult = tx
          .insert(schema.stamps)
          .values({
            id,
            planId: input.planId,
            deviceId: input.deviceId,
            locationId: locationId ?? null,
            position: input.position,
            createdAt: now,
            updatedAt: now,
          })
          .returning()
          .get();

        // Create revision record for undo/redo
        tx.insert(schema.stampRevisions).values({
          id: revisionId,
          stampId: id,
          type: 'create',
          snapshot: null, // No previous state for create
          createdAt: now,
        }).run();

        return stampResult;
      });

      const dto = this.toDTO(result);

      // Emit count update event (async, don't await)
      this.emitCountEvent(dto.planId, dto.deviceId, dto.locationId).catch(console.error);

      return dto;
    } catch (error: unknown) {
      // Check for foreign key constraint violations
      const err = error as { code?: string; message?: string };
      if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || err.message?.includes('FOREIGN KEY')) {
        throw new ServiceError(
          ServiceErrorCode.FOREIGN_KEY_VIOLATION,
          'Plan or device does not exist',
          error,
        );
      }

      throw new ServiceError(
        ServiceErrorCode.DATABASE_ERROR,
        'Failed to create stamp',
        error,
      );
    }
  }

  /**
   * Update a stamp with optimistic locking and revision tracking (transactional)
   *
   * @param id - Stamp ID
   * @param input - Stamp update data
   * @returns Updated stamp DTO or null if not found
   * @throws OptimisticLockError if updatedAt doesn't match (concurrent modification)
   */
  async update(id: string, input: UpdateStampInput): Promise<StampDTO | null> {
    // Check if stamp exists and get current state
    const existing = await this.getById(id);
    if (!existing) {
      return null;
    }

    // Optimistic locking: check if updatedAt matches
    if (input.updatedAt) {
      const existingTime = existing.updatedAt.getTime();
      const providedTime = input.updatedAt.getTime();

      if (existingTime !== providedTime) {
        throw new OptimisticLockError(
          'Stamp has been modified by another user. Please refresh and try again.',
        );
      }
    }

    const revisionId = randomUUID();
    const now = new Date();

    try {
      // Execute in transaction
      const result = this.db.transaction((tx) => {
        // Update the stamp
        const updated = tx
          .update(schema.stamps)
          .set({
            ...(input.position !== undefined && { position: input.position }),
            ...(input.locationId !== undefined && { locationId: input.locationId }),
            updatedAt: now,
          })
          .where(eq(schema.stamps.id, id))
          .returning()
          .get();

        // Create revision record with previous state
        tx.insert(schema.stampRevisions).values({
          id: revisionId,
          stampId: id,
          type: 'update',
          snapshot: existing, // Save previous state for undo
          createdAt: now,
        }).run();

        return updated;
      });

      const dto = this.toDTO(result);

      // Emit count update events for both old and new locations if location changed
      if (input.locationId !== undefined && existing.locationId !== dto.locationId) {
        // Old location count changed
        this.emitCountEvent(dto.planId, dto.deviceId, existing.locationId).catch(console.error);
        // New location count changed
        this.emitCountEvent(dto.planId, dto.deviceId, dto.locationId).catch(console.error);
      }

      return dto;
    } catch (error) {
      throw new ServiceError(
        ServiceErrorCode.DATABASE_ERROR,
        `Failed to update stamp ${id}`,
        error,
      );
    }
  }

  /**
   * Delete a stamp with revision tracking (transactional)
   *
   * @param id - Stamp ID
   * @returns True if deleted, false if not found
   */
  async delete(id: string): Promise<boolean> {
    // Get current state before deletion
    const existing = await this.getById(id);
    if (!existing) {
      return false;
    }

    const revisionId = randomUUID();
    const now = new Date();

    try {
      // Execute in transaction
      this.db.transaction((tx) => {
        // Create revision record before deletion
        tx.insert(schema.stampRevisions).values({
          id: revisionId,
          stampId: id,
          type: 'delete',
          snapshot: existing, // Save state for potential undo
          createdAt: now,
        }).run();

        // Delete the stamp (this will cascade to revisions per schema)
        tx.delete(schema.stamps).where(eq(schema.stamps.id, id)).run();
      });

      // Emit count update event (async, don't await)
      this.emitCountEvent(existing.planId, existing.deviceId, existing.locationId).catch(console.error);

      return true;
    } catch (error) {
      throw new ServiceError(
        ServiceErrorCode.DATABASE_ERROR,
        `Failed to delete stamp ${id}`,
        error,
      );
    }
  }

  /**
   * Get revision history for a stamp
   *
   * @param stampId - Stamp ID
   * @returns Array of stamp revisions
   */
  async getRevisions(stampId: string): Promise<StampRevisionDTO[]> {
    try {
      const results = await this.db
        .select()
        .from(schema.stampRevisions)
        .where(eq(schema.stampRevisions.stampId, stampId))
        .orderBy(schema.stampRevisions.createdAt);

      return results.map((result) => this.revisionToDTO(result));
    } catch (error) {
      throw new ServiceError(
        ServiceErrorCode.DATABASE_ERROR,
        `Failed to get revisions for stamp ${stampId}`,
        error,
      );
    }
  }

  /**
   * Update stamps within a location's bounds (used when location is created/updated)
   *
   * @param planId - Plan ID
   * @param locationId - Location ID
   * @param geometry - Location geometry
   */
  async updateStampsInLocation(planId: string, locationId: string, geometry: GeometryLocation): Promise<void> {
    try {
      // Fetch all stamps for the plan (excluding those already in this location)
      // We fetch ALL because a stamp might have been moved INTO this location from another or from null
      // But for efficiency, we might only want to check those that are potentially affected?
      // Simplest: Check all stamps in the plan.
      const stamps = await this.db
        .select()
        .from(schema.stamps)
        .where(eq(schema.stamps.planId, planId));

      const stampsToUpdate: string[] = [];
      const stampsToRemoveFromLocation: string[] = [];

      for (const stamp of stamps) {
        const point = { x: (stamp.position as StampPosition).x, y: (stamp.position as StampPosition).y };
        const isInside = classifyPoint(point, geometry);

        if (isInside && stamp.locationId !== locationId) {
          // Stamp is inside but not assigned to this location -> assign it
          stampsToUpdate.push(stamp.id);
        } else if (!isInside && stamp.locationId === locationId) {
           // Stamp is outside but currently assigned to this location -> unassign it (set to null)
           // Wait, if it's outside this location, it might be inside ANOTHER location.
           // But we don't know that here easily.
           // For now, if we are updating THIS location, we can say:
           // - If inside, set to THIS location.
           // - If previously in THIS location but now outside (e.g. location shrank), set to NULL (or re-evaluate?)
           // Safest is to set to NULL and let a full re-evaluation handle it, or just set to NULL.
           stampsToRemoveFromLocation.push(stamp.id);
        }
      }

      if (stampsToUpdate.length > 0) {
        const now = new Date();
        this.db.transaction((tx) => {
           // Update stamps to new location
           tx.update(schema.stamps)
             .set({ locationId: locationId, updatedAt: now })
             .where(inArray(schema.stamps.id, stampsToUpdate))
             .run();

           // We should emit events, but doing it in bulk is tricky.
           // For now, simpler to just let them update.
           // Triggers in DB maintain counts, but we need to broadcast count updates.
           // Iterate and emit? Or just emit "refresh"?
           // The trigger maintains the count table. We just need to notify frontend.
           // The count service emits based on specific device/location.
           // Ideally we'd group by deviceId and emit once per device/location pair.
        });

        // Emit count updates for affected stamps
        // Group by deviceId to minimize events
        const deviceIds = new Set<string>();
        stamps.filter(s => stampsToUpdate.includes(s.id)).forEach(s => deviceIds.add(s.deviceId));
        for (const deviceId of deviceIds) {
           this.emitCountEvent(planId, deviceId, locationId).catch(console.error);
           this.emitCountEvent(planId, deviceId, null).catch(console.error); // Decrement unassigned
        }
      }

      if (stampsToRemoveFromLocation.length > 0) {
         const now = new Date();
         this.db.transaction((tx) => {
            tx.update(schema.stamps)
              .set({ locationId: null, updatedAt: now })
              .where(inArray(schema.stamps.id, stampsToRemoveFromLocation))
              .run();
         });

         const deviceIds = new Set<string>();
         stamps.filter(s => stampsToRemoveFromLocation.includes(s.id)).forEach(s => deviceIds.add(s.deviceId));
         for (const deviceId of deviceIds) {
            this.emitCountEvent(planId, deviceId, locationId).catch(console.error); // Decrement location
            this.emitCountEvent(planId, deviceId, null).catch(console.error); // Increment unassigned
         }
      }

    } catch (error) {
      console.error('Failed to update stamps in location:', error);
      // Don't throw, just log - this is a background maintenance task
    }
  }

  /**
   * Convert database row to DTO
   *
   * @param row - Database row
   * @returns Stamp DTO
   */
  private toDTO(row: typeof schema.stamps.$inferSelect): StampDTO {
    return {
      id: row.id,
      planId: row.planId,
      deviceId: row.deviceId,
      locationId: row.locationId,
      position: row.position as StampPosition,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Convert revision database row to DTO
   *
   * @param row - Database row
   * @returns Stamp revision DTO
   */
  private revisionToDTO(row: typeof schema.stampRevisions.$inferSelect): StampRevisionDTO {
    return {
      id: row.id,
      stampId: row.stampId,
      type: row.type,
      snapshot: row.snapshot ? (row.snapshot as StampDTO) : null,
      createdAt: row.createdAt,
    };
  }
}

/**
 * Factory function to create stamp service
 *
 * @param db - Database instance
 * @returns Stamp service instance
 */
export function createStampService(
  db: BetterSQLite3Database<typeof schema>,
): StampService {
  return new StampService(db);
}
