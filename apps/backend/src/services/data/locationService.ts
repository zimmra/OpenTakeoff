/**
 * Location Service
 * Data layer for location CRUD operations with revision tracking
 */

import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../../db/schema.js';
import { ServiceError, ServiceErrorCode } from './types.js';
import { createStampService } from './stampService.js';
import type { GeometryLocation } from '../../utils/geometry.js';

/**
 * Rectangle bounds interface
 */
export interface RectangleBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Vertex interface for polygons
 */
export interface Vertex {
  x: number;
  y: number;
}

/**
 * Location DTO (Data Transfer Object)
 */
export interface LocationDTO {
  id: string;
  planId: string;
  name: string;
  type: 'rectangle' | 'polygon';
  bounds: RectangleBounds | null;
  vertices: Vertex[];
  color: string | null;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input for creating a rectangle location
 */
export interface CreateRectangleLocationInput {
  planId: string;
  name: string;
  bounds: RectangleBounds;
  color?: string;
}

/**
 * Input for creating a polygon location
 */
export interface CreatePolygonLocationInput {
  planId: string;
  name: string;
  vertices: Vertex[];
  color?: string;
}

/**
 * Input for updating a location
 */
export interface UpdateLocationInput {
  name?: string;
  bounds?: RectangleBounds | null;
  vertices?: Vertex[];
  color?: string | null;
}

/**
 * Location Service
 * Encapsulates all location data access logic with revision tracking
 */
export class LocationService {
  constructor(private db: BetterSQLite3Database<typeof schema>) {}

  /**
   * List all locations for a plan
   *
   * @param planId - Plan ID
   * @returns Array of location DTOs
   */
  async listByPlan(planId: string): Promise<LocationDTO[]> {
    try {
      const locations = await this.db
        .select()
        .from(schema.locations)
        .where(eq(schema.locations.planId, planId))
        .orderBy(schema.locations.createdAt);

      // Load vertices for polygon locations
      const result: LocationDTO[] = [];
      for (const location of locations) {
        const dto = await this.toDTO(location);
        result.push(dto);
      }

      return result;
    } catch (error) {
      throw new ServiceError(
        ServiceErrorCode.DATABASE_ERROR,
        `Failed to list locations for plan ${planId}`,
        error,
      );
    }
  }

  /**
   * Get a location by ID
   *
   * @param id - Location ID
   * @returns Location DTO or null if not found
   */
  async getById(id: string): Promise<LocationDTO | null> {
    try {
      const results = await this.db
        .select()
        .from(schema.locations)
        .where(eq(schema.locations.id, id))
        .limit(1);

      const location = results[0];
      if (!location) {
        return null;
      }

      return await this.toDTO(location);
    } catch (error) {
      throw new ServiceError(
        ServiceErrorCode.DATABASE_ERROR,
        `Failed to get location ${id}`,
        error,
      );
    }
  }

  /**
   * Create a rectangle location
   *
   * @param input - Rectangle location creation data
   * @returns Created location DTO
   */
  async createRectangle(input: CreateRectangleLocationInput): Promise<LocationDTO> {
    const id = randomUUID();
    const now = new Date();

    try {
      const location = this.db.transaction((tx) => {
        const result = tx
          .insert(schema.locations)
          .values({
            id,
            planId: input.planId,
            name: input.name,
            type: 'rectangle',
            bounds: input.bounds,
            color: input.color ?? null,
            revision: 0,
            createdAt: now,
            updatedAt: now,
          })
          .returning()
          .get();

        // Create revision entry for create action
        this.createRevision(tx, id, 'create', null);

        return result;
      });

      const dto = await this.toDTO(location);

      // Trigger stamp location update
      const stampService = createStampService(this.db);
      const geometry: GeometryLocation = {
        type: 'rectangle',
        bounds: dto.bounds,
      };
      await stampService.updateStampsInLocation(dto.planId, dto.id, geometry);

      return dto;
    } catch (error) {
      console.error('Error creating rectangle location:', error);
      throw new ServiceError(
        ServiceErrorCode.DATABASE_ERROR,
        'Failed to create rectangle location',
        error,
      );
    }
  }

  /**
   * Create a polygon location
   *
   * @param input - Polygon location creation data
   * @returns Created location DTO
   */
  async createPolygon(input: CreatePolygonLocationInput): Promise<LocationDTO> {
    const id = randomUUID();
    const now = new Date();

    // Validate vertices (minimum 3 unique vertices)
    if (input.vertices.length < 3) {
      throw new ServiceError(
        ServiceErrorCode.INVALID_INPUT,
        'Polygon must have at least 3 vertices',
      );
    }

    try {
      const location = this.db.transaction((tx) => {
        // Create location
        const result = tx
          .insert(schema.locations)
          .values({
            id,
            planId: input.planId,
            name: input.name,
            type: 'polygon',
            bounds: null,
            color: input.color ?? null,
            revision: 0,
            createdAt: now,
            updatedAt: now,
          })
          .returning()
          .get();

        // Insert vertices with sequence numbers
        const vertexValues = input.vertices.map((vertex, index) => ({
          id: randomUUID(),
          locationId: id,
          sequence: index,
          x: vertex.x,
          y: vertex.y,
        }));

        tx.insert(schema.locationVertices).values(vertexValues).run();

        // Create revision entry
        this.createRevision(tx, id, 'create', null);

        return result;
      });

      const dto = await this.toDTO(location);

      // Trigger stamp location update
      const stampService = createStampService(this.db);
      const geometry: GeometryLocation = {
        type: 'polygon',
        bounds: null,
        vertices: dto.vertices,
      };
      await stampService.updateStampsInLocation(dto.planId, dto.id, geometry);

      return dto;
    } catch (error) {
      console.error('Error creating polygon location:', error);
      throw new ServiceError(
        ServiceErrorCode.DATABASE_ERROR,
        'Failed to create polygon location',
        error,
      );
    }
  }

  /**
   * Update a location
   *
   * @param id - Location ID
   * @param input - Location update data
   * @returns Updated location DTO or null if not found
   */
  async update(id: string, input: UpdateLocationInput): Promise<LocationDTO | null> {
    // Get existing location for snapshot
    const existing = await this.getById(id);
    if (!existing) {
      return null;
    }

    const now = new Date();

    try {
      const updated = this.db.transaction((tx) => {
        // Create snapshot for undo
        this.createRevision(tx, id, 'update', {
          name: existing.name,
          type: existing.type,
          bounds: existing.bounds,
          vertices: existing.vertices,
          color: existing.color,
        });

        // Update location metadata
        const updateValues: Partial<typeof schema.locations.$inferInsert> = {
          updatedAt: now,
          revision: existing.revision + 1,
        };

        if (input.name !== undefined) {
          updateValues.name = input.name;
        }

        if (input.color !== undefined) {
          updateValues.color = input.color;
        }

        // Handle geometry updates
        if (existing.type === 'rectangle' && input.bounds !== undefined) {
          updateValues.bounds = input.bounds;
        } else if (existing.type === 'polygon' && input.vertices !== undefined) {
          // Validate vertices
          if (input.vertices.length < 3) {
            throw new ServiceError(
              ServiceErrorCode.INVALID_INPUT,
              'Polygon must have at least 3 vertices',
            );
          }

          // Delete existing vertices
          tx.delete(schema.locationVertices)
            .where(eq(schema.locationVertices.locationId, id))
            .run();

          // Insert new vertices
          const vertexValues = input.vertices.map((vertex, index) => ({
            id: randomUUID(),
            locationId: id,
            sequence: index,
            x: vertex.x,
            y: vertex.y,
          }));

          tx.insert(schema.locationVertices).values(vertexValues).run();
        }

        // Update location
        return tx
          .update(schema.locations)
          .set(updateValues)
          .where(eq(schema.locations.id, id))
          .returning()
          .get();
      });

      const dto = await this.toDTO(updated);

      // Trigger stamp location update
      const stampService = createStampService(this.db);
      const geometry: GeometryLocation = {
        type: dto.type,
        bounds: dto.bounds,
        vertices: dto.vertices,
      };
      await stampService.updateStampsInLocation(dto.planId, dto.id, geometry);

      return dto;
    } catch (error) {
      if (error instanceof ServiceError) {
        throw error;
      }
      throw new ServiceError(
        ServiceErrorCode.DATABASE_ERROR,
        `Failed to update location ${id}`,
        error,
      );
    }
  }

  /**
   * Delete a location
   *
   * @param id - Location ID
   * @returns True if deleted, false if not found
   */
  async delete(id: string): Promise<boolean> {
    // Get existing location for snapshot
    const existing = await this.getById(id);
    if (!existing) {
      return false;
    }

    try {
      return this.db.transaction((tx) => {
        // Create snapshot for undo
        this.createRevision(tx, id, 'delete', {
          name: existing.name,
          type: existing.type,
          bounds: existing.bounds,
          vertices: existing.vertices,
          color: existing.color,
        });

        // Delete location (cascades to vertices and revisions)
        const result = tx
          .delete(schema.locations)
          .where(eq(schema.locations.id, id))
          .returning()
          .all();

        return result.length > 0;
      });
    } catch (error) {
      throw new ServiceError(
        ServiceErrorCode.DATABASE_ERROR,
        `Failed to delete location ${id}`,
        error,
      );
    }
  }

  /**
   * Create a revision entry
   *
   * @param tx - Database transaction
   * @param locationId - Location ID
   * @param type - Revision type
   * @param snapshot - Data snapshot (null for create)
   */
  private createRevision(
    tx: BetterSQLite3Database<typeof schema>,
    locationId: string,
    type: 'create' | 'update' | 'delete',
    snapshot: unknown,
  ): void {
    tx.insert(schema.locationRevisions)
      .values({
        id: randomUUID(),
        locationId,
        type,
        snapshot: snapshot ?? null,
        createdAt: new Date(),
      })
      .run();
  }

  /**
   * Convert database row to DTO with vertices loaded
   *
   * @param row - Database row
   * @returns Location DTO
   */
  private async toDTO(row: typeof schema.locations.$inferSelect): Promise<LocationDTO> {
    let vertices: Vertex[] = [];

    // Load vertices for polygon type
    if (row.type === 'polygon') {
      const vertexRows = await this.db
        .select()
        .from(schema.locationVertices)
        .where(eq(schema.locationVertices.locationId, row.id))
        .orderBy(schema.locationVertices.sequence);

      vertices = vertexRows.map((v) => ({ x: v.x, y: v.y }));
    }

    // Ensure dates are proper Date objects (may be integers from SQLite)
    const createdAt = row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt);
    const updatedAt = row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt);

    // Handle bounds parsing safely
    let bounds: RectangleBounds | null = null;
    if (row.bounds) {
      if (typeof row.bounds === 'string') {
        try {
          bounds = JSON.parse(row.bounds) as RectangleBounds;
        } catch (e) {
          console.error('Failed to parse bounds JSON:', e);
        }
      } else {
        bounds = row.bounds as RectangleBounds;
      }
    }

    return {
      id: row.id,
      planId: row.planId,
      name: row.name,
      type: row.type,
      bounds,
      vertices,
      color: row.color,
      revision: row.revision,
      createdAt,
      updatedAt,
    };
  }
}

/**
 * Factory function to create location service
 *
 * @param db - Database instance
 * @returns Location service instance
 */
export function createLocationService(
  db: BetterSQLite3Database<typeof schema>,
): LocationService {
  return new LocationService(db);
}
