/**
 * Device Service
 * Data layer for device CRUD operations
 */

import { eq, and, gt } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../../db/schema.js';
import type {
  DeviceDTO,
  CreateDeviceInput,
  UpdateDeviceInput,
  PaginationParams,
  PaginatedResponse,
} from './types.js';
import { ServiceError, ServiceErrorCode } from './types.js';

/**
 * Default pagination limit
 */
const DEFAULT_LIMIT = 50;

/**
 * Maximum pagination limit
 */
const MAX_LIMIT = 100;

/**
 * Device Service
 * Encapsulates all device data access logic
 */
export class DeviceService {
  constructor(private db: BetterSQLite3Database<typeof schema>) {}

  /**
   * List devices for a project with pagination
   *
   * @param projectId - Project ID
   * @param params - Pagination parameters
   * @returns Paginated list of devices
   */
  async listByProject(
    projectId: string,
    params: PaginationParams = {},
  ): Promise<PaginatedResponse<DeviceDTO>> {
    const limit = Math.min(params.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const cursor = params.cursor;

    try {
      // Build where clause
      const whereClause = cursor
        ? and(
            eq(schema.devices.projectId, projectId),
            gt(schema.devices.id, cursor),
          )
        : eq(schema.devices.projectId, projectId);

      // Build query with consistent ordering by id
      const query = this.db
        .select()
        .from(schema.devices)
        .where(whereClause)
        .orderBy(schema.devices.id)
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
        `Failed to list devices for project ${projectId}`,
        error,
      );
    }
  }

  /**
   * Get a device by ID
   *
   * @param id - Device ID
   * @returns Device DTO or null if not found
   */
  async getById(id: string): Promise<DeviceDTO | null> {
    try {
      const results = await this.db
        .select()
        .from(schema.devices)
        .where(eq(schema.devices.id, id))
        .limit(1);

      const device = results[0];
      if (!device) {
        return null;
      }

      return this.toDTO(device);
    } catch (error) {
      throw new ServiceError(
        ServiceErrorCode.DATABASE_ERROR,
        `Failed to get device ${id}`,
        error,
      );
    }
  }

  /**
   * Create a new device
   *
   * @param input - Device creation data
   * @returns Created device DTO
   * @throws ServiceError with ALREADY_EXISTS if device with same name exists in project
   */
  async create(input: CreateDeviceInput): Promise<DeviceDTO> {
    const id = randomUUID();
    const now = new Date();

    try {
      const result = await this.db
        .insert(schema.devices)
        .values({
          id,
          projectId: input.projectId,
          name: input.name,
          description: input.description ?? null,
          color: input.color ?? null,
          iconKey: input.iconKey ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      const device = result[0];
      if (!device) {
        throw new ServiceError(ServiceErrorCode.DATABASE_ERROR, 'Failed to create device');
      }
      return this.toDTO(device);
    } catch (error: unknown) {
      // Check for unique constraint violation (duplicate device name in project)
      const err = error as { code?: string; message?: string };
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.message?.includes('UNIQUE')) {
        throw new ServiceError(
          ServiceErrorCode.ALREADY_EXISTS,
          `Device with name "${input.name}" already exists in this project`,
          error,
        );
      }

      throw new ServiceError(
        ServiceErrorCode.DATABASE_ERROR,
        'Failed to create device',
        error,
      );
    }
  }

  /**
   * Update a device
   *
   * @param id - Device ID
   * @param input - Device update data
   * @returns Updated device DTO or null if not found
   * @throws ServiceError with ALREADY_EXISTS if name conflicts with another device
   */
  async update(id: string, input: UpdateDeviceInput): Promise<DeviceDTO | null> {
    // Check if device exists
    const existing = await this.getById(id);
    if (!existing) {
      return null;
    }

    const now = new Date();

    try {
      const result = await this.db
        .update(schema.devices)
        .set({
          ...(input.name !== undefined && { name: input.name }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.color !== undefined && { color: input.color }),
          ...(input.iconKey !== undefined && { iconKey: input.iconKey }),
          updatedAt: now,
        })
        .where(eq(schema.devices.id, id))
        .returning();

      const updated = result[0];
      if (!updated) {
        throw new ServiceError(ServiceErrorCode.DATABASE_ERROR, `Failed to update device ${id}`);
      }
      return this.toDTO(updated);
    } catch (error: unknown) {
      // Check for unique constraint violation
      const err = error as { code?: string; message?: string };
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.message?.includes('UNIQUE')) {
        throw new ServiceError(
          ServiceErrorCode.ALREADY_EXISTS,
          `Device with name "${input.name}" already exists in this project`,
          error,
        );
      }

      throw new ServiceError(
        ServiceErrorCode.DATABASE_ERROR,
        `Failed to update device ${id}`,
        error,
      );
    }
  }

  /**
   * Delete a device
   * Note: This will cascade delete all related stamps per schema
   *
   * @param id - Device ID
   * @returns True if deleted, false if not found
   */
  async delete(id: string): Promise<boolean> {
    try {
      const result = await this.db
        .delete(schema.devices)
        .where(eq(schema.devices.id, id))
        .returning();

      return result.length > 0;
    } catch (error) {
      throw new ServiceError(
        ServiceErrorCode.DATABASE_ERROR,
        `Failed to delete device ${id}`,
        error,
      );
    }
  }

  /**
   * Convert database row to DTO
   *
   * @param row - Database row
   * @returns Device DTO
   */
  private toDTO(row: typeof schema.devices.$inferSelect): DeviceDTO {
    return {
      id: row.id,
      projectId: row.projectId,
      name: row.name,
      description: row.description,
      color: row.color,
      iconKey: row.iconKey,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

/**
 * Factory function to create device service
 *
 * @param db - Database instance
 * @returns Device service instance
 */
export function createDeviceService(
  db: BetterSQLite3Database<typeof schema>,
): DeviceService {
  return new DeviceService(db);
}
