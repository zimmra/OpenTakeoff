/**
 * History Service
 * Manages undo/redo functionality by aggregating stamp and location revisions
 */

import { desc, or, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../../db/schema.js';
import type {
  HistoryEntryDTO,
  HistoryActionResult,
  StampDTO,
} from './types.js';
import type { LocationDTO } from './locationService.js';
import { ServiceError, ServiceErrorCode } from './types.js';

/**
 * Maximum number of revisions to keep in history stack
 */
const MAX_HISTORY_ENTRIES = 100;

/**
 * History Service
 * Provides undo/redo functionality by managing revision history
 */
export class HistoryService {
  constructor(private db: BetterSQLite3Database<typeof schema>) {}

  /**
   * Get combined history entries from stamps and locations
   * Limited to MAX_HISTORY_ENTRIES, ordered by most recent first
   *
   * @param projectId - Project ID to scope history
   * @returns Array of history entries
   */
  async getHistory(projectId: string): Promise<HistoryEntryDTO[]> {
    try {
      // Query stamp revisions with plan/project join
      const stampRevisions = await this.db
        .select({
          id: schema.stampRevisions.id,
          entityId: schema.stampRevisions.stampId,
          type: schema.stampRevisions.type,
          snapshot: schema.stampRevisions.snapshot,
          createdAt: schema.stampRevisions.createdAt,
          planId: schema.stamps.planId,
        })
        .from(schema.stampRevisions)
        .leftJoin(schema.stamps, eq(schema.stampRevisions.stampId, schema.stamps.id))
        .leftJoin(schema.plans, eq(schema.stamps.planId, schema.plans.id))
        .where(eq(schema.plans.projectId, projectId))
        .orderBy(desc(schema.stampRevisions.createdAt))
        .limit(MAX_HISTORY_ENTRIES);

      // Query location revisions with plan/project join
      const locationRevisions = await this.db
        .select({
          id: schema.locationRevisions.id,
          entityId: schema.locationRevisions.locationId,
          type: schema.locationRevisions.type,
          snapshot: schema.locationRevisions.snapshot,
          createdAt: schema.locationRevisions.createdAt,
          planId: schema.locations.planId,
        })
        .from(schema.locationRevisions)
        .leftJoin(schema.locations, eq(schema.locationRevisions.locationId, schema.locations.id))
        .leftJoin(schema.plans, eq(schema.locations.planId, schema.plans.id))
        .where(eq(schema.plans.projectId, projectId))
        .orderBy(desc(schema.locationRevisions.createdAt))
        .limit(MAX_HISTORY_ENTRIES);

      // Combine and sort by timestamp
      const stampEntries: HistoryEntryDTO[] = stampRevisions.map((r) => ({
        id: r.id,
        entityId: r.entityId,
        entityType: 'stamp' as const,
        type: r.type,
        snapshot: r.snapshot as StampDTO | null,
        createdAt: r.createdAt,
      }));

      const locationEntries: HistoryEntryDTO[] = locationRevisions.map((r) => ({
        id: r.id,
        entityId: r.entityId,
        entityType: 'location' as const,
        type: r.type,
        snapshot: (r.snapshot) as LocationDTO | null,
        createdAt: r.createdAt,
      }));

      const combined = [...stampEntries, ...locationEntries];

      // Sort by createdAt descending (most recent first)
      combined.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      // Return only MAX_HISTORY_ENTRIES
      return combined.slice(0, MAX_HISTORY_ENTRIES);
    } catch (error) {
      throw new ServiceError(
        ServiceErrorCode.DATABASE_ERROR,
        `Failed to get history for project ${projectId}`,
        error,
      );
    }
  }

  /**
   * Undo the most recent action
   * Reverts the entity to its previous state
   *
   * @param projectId - Project ID
   * @returns Action result with restored state
   */
  async undo(projectId: string): Promise<HistoryActionResult | null> {
    try {
      const history = await this.getHistory(projectId);

      if (history.length === 0) {
        return null; // Nothing to undo
      }

      const latestEntry = history[0];
      if (!latestEntry) {
         return null;
      }

      // Execute undo in transaction
      return this.db.transaction((tx) => {
        if (latestEntry.entityType === 'stamp') {
          return this.undoStampRevision(tx, latestEntry);
        } else {
          return this.undoLocationRevision(tx, latestEntry);
        }
      });
    } catch (error) {
      throw new ServiceError(
        ServiceErrorCode.DATABASE_ERROR,
        'Failed to undo action',
        error,
      );
    }
  }

  /**
   * Undo a stamp revision
   *
   * @param tx - Transaction handle
   * @param entry - History entry
   * @returns Action result
   */
  private undoStampRevision(
    tx: BetterSQLite3Database<typeof schema>,
    entry: HistoryEntryDTO,
  ): HistoryActionResult {
    const { entityId, type, snapshot } = entry;

    if (type === 'create') {
      // Undo create = delete the stamp
      tx.delete(schema.stamps).where(eq(schema.stamps.id, entityId)).run();

      return {
        success: true,
        entityType: 'stamp',
        entityId,
        action: 'undo',
      };
    } else if (type === 'update') {
      // Undo update = restore previous snapshot
      if (!snapshot) {
        throw new ServiceError(
          ServiceErrorCode.INVALID_INPUT,
          'Cannot undo update: snapshot is null',
        );
      }

      const stampSnapshot = snapshot as StampDTO;
      tx.update(schema.stamps)
        .set({
          position: stampSnapshot.position,
          locationId: stampSnapshot.locationId,
          updatedAt: new Date(),
        })
        .where(eq(schema.stamps.id, entityId))
        .run();

      return {
        success: true,
        entityType: 'stamp',
        entityId,
        action: 'undo',
        restoredState: stampSnapshot,
      };
    } else {
      // type === 'delete': Undo delete = recreate the stamp from snapshot
      if (!snapshot) {
        throw new ServiceError(
          ServiceErrorCode.INVALID_INPUT,
          'Cannot undo delete: snapshot is null',
        );
      }

      const stampSnapshot = snapshot as StampDTO;
      tx.insert(schema.stamps)
        .values({
          id: entityId,
          planId: stampSnapshot.planId,
          deviceId: stampSnapshot.deviceId,
          locationId: stampSnapshot.locationId,
          position: stampSnapshot.position,
          createdAt: stampSnapshot.createdAt,
          updatedAt: new Date(),
        })
        .run();

      return {
        success: true,
        entityType: 'stamp',
        entityId,
        action: 'undo',
        restoredState: stampSnapshot,
      };
    }

    throw new ServiceError(
      ServiceErrorCode.INVALID_INPUT,
      `Unknown revision type: ${type as string}`,
    );
  }

  /**
   * Undo a location revision
   *
   * @param tx - Transaction handle
   * @param entry - History entry
   * @returns Action result
   */
  private undoLocationRevision(
    tx: BetterSQLite3Database<typeof schema>,
    entry: HistoryEntryDTO,
  ): HistoryActionResult {
    const { entityId, type, snapshot } = entry;

    if (type === 'create') {
      // Undo create = delete the location
      tx.delete(schema.locations).where(eq(schema.locations.id, entityId)).run();

      return {
        success: true,
        entityType: 'location',
        entityId,
        action: 'undo',
      };
    } else {
      // type === 'update' || 'delete': For both update and delete, we need to restore the snapshot
      if (!snapshot) {
        throw new ServiceError(
          ServiceErrorCode.INVALID_INPUT,
          `Cannot undo ${type}: snapshot is null`,
        );
      }

      const locationSnapshot = snapshot as unknown as LocationDTO;

      if (type === 'update') {
        // Restore previous state
        tx.update(schema.locations)
          .set({
            name: locationSnapshot.name,
            type: locationSnapshot.type,
            bounds: locationSnapshot.bounds,
            color: locationSnapshot.color,
            revision: tx
              .select({ revision: schema.locations.revision })
              .from(schema.locations)
              .where(eq(schema.locations.id, entityId))
              .get()?.revision ?? 0 + 1,
            updatedAt: new Date(),
          })
          .where(eq(schema.locations.id, entityId))
          .run();

        // Update vertices if polygon
        if (locationSnapshot.type === 'polygon' && locationSnapshot.vertices.length > 0) {
          // Delete existing vertices
          tx.delete(schema.locationVertices)
            .where(eq(schema.locationVertices.locationId, entityId))
            .run();

          // Insert vertices from snapshot
          for (const [i, vertex] of locationSnapshot.vertices.entries()) {
            tx.insert(schema.locationVertices)
              .values({
                id: randomUUID(),
                locationId: entityId,
                sequence: i,
                x: vertex.x,
                y: vertex.y,
              })
              .run();
          }
        }
      } else {
        // type === 'delete': recreate location from snapshot
        tx.insert(schema.locations)
          .values({
            id: entityId,
            planId: locationSnapshot.planId,
            name: locationSnapshot.name,
            type: locationSnapshot.type,
            bounds: locationSnapshot.bounds,
            color: locationSnapshot.color,
            revision: locationSnapshot.revision,
            createdAt: locationSnapshot.createdAt,
            updatedAt: new Date(),
          })
          .run();

        // Recreate vertices if polygon
        if (locationSnapshot.type === 'polygon' && locationSnapshot.vertices.length > 0) {
          for (const [i, vertex] of locationSnapshot.vertices.entries()) {
            tx.insert(schema.locationVertices)
              .values({
                id: randomUUID(),
                locationId: entityId,
                sequence: i,
                x: vertex.x,
                y: vertex.y,
              })
              .run();
          }
        }
      }

      return {
        success: true,
        entityType: 'location',
        entityId,
        action: 'undo',
        restoredState: locationSnapshot as StampDTO | LocationDTO,
      };
    }

    throw new ServiceError(
      ServiceErrorCode.INVALID_INPUT,
      `Unknown revision type: ${type as string}`,
    );
  }

  /**
   * Prune old history entries beyond MAX_HISTORY_ENTRIES
   *
   * @param projectId - Project ID
   */
  async pruneHistory(projectId: string): Promise<void> {
    try {
      const history = await this.getHistory(projectId);

      if (history.length <= MAX_HISTORY_ENTRIES) {
        return; // Nothing to prune
      }

      // Get entries to delete (oldest entries)
      const entriesToDelete = history.slice(MAX_HISTORY_ENTRIES);

      // Delete in transaction
      this.db.transaction((tx) => {
        const stampRevisionIds = entriesToDelete
          .filter((e) => e.entityType === 'stamp')
          .map((e) => e.id);

        const locationRevisionIds = entriesToDelete
          .filter((e) => e.entityType === 'location')
          .map((e) => e.id);

        if (stampRevisionIds.length > 0) {
          tx.delete(schema.stampRevisions)
            .where(
              or(...stampRevisionIds.map((id) => eq(schema.stampRevisions.id, id))),
            )
            .run();
        }

        if (locationRevisionIds.length > 0) {
          tx.delete(schema.locationRevisions)
            .where(
              or(...locationRevisionIds.map((id) => eq(schema.locationRevisions.id, id))),
            )
            .run();
        }
      });
    } catch (error) {
      throw new ServiceError(
        ServiceErrorCode.DATABASE_ERROR,
        `Failed to prune history for project ${projectId}`,
        error,
      );
    }
  }
}

/**
 * Factory function to create history service
 *
 * @param db - Database instance
 * @returns History service instance
 */
export function createHistoryService(
  db: BetterSQLite3Database<typeof schema>,
): HistoryService {
  return new HistoryService(db);
}
