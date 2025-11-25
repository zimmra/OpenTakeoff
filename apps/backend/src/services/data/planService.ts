/**
 * Plan Service
 * Data layer for plan CRUD operations and metadata access
 */

import { eq, and, gt } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../../db/schema.js';
import type {
  PlanDTO,
  PlanMetadataDTO,
  CreatePlanInput,
  UpdatePlanInput,
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
 * Plan Service
 * Encapsulates all plan data access logic
 */
export class PlanService {
  constructor(private db: BetterSQLite3Database<typeof schema>) {}

  /**
   * List all plans with pagination
   *
   * @param params - Pagination parameters
   * @returns Paginated list of plan metadata
   */
  async list(params: PaginationParams = {}): Promise<PaginatedResponse<PlanMetadataDTO>> {
    const limit = Math.min(params.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const cursor = params.cursor;

    try {
      // Build where clause
      const whereClause = cursor ? gt(schema.plans.id, cursor) : undefined;

      // Build query with consistent ordering by id
      const queryBuilder = this.db.select().from(schema.plans);

      const query = whereClause
        ? queryBuilder.where(whereClause).orderBy(schema.plans.id).limit(limit + 1)
        : queryBuilder.orderBy(schema.plans.id).limit(limit + 1);

      const results = await query;

      // Determine if there are more items
      const hasMore = results.length > limit;
      const items = hasMore ? results.slice(0, limit) : results;

      // Get next cursor
      const lastItem = items[items.length - 1];
      const nextCursor = hasMore && lastItem ? lastItem.id : null;

      return {
        items: items.map((item) => this.toMetadataDTO(item)),
        pagination: {
          count: items.length,
          nextCursor,
          hasMore,
        },
      };
    } catch (error) {
      throw new ServiceError(ServiceErrorCode.DATABASE_ERROR, 'Failed to list plans', error);
    }
  }

  /**
   * List plans for a specific project
   *
   * @param projectId - Project ID
   * @param params - Pagination parameters
   * @returns Paginated list of plan metadata
   */
  async listByProject(
    projectId: string,
    params: PaginationParams = {},
  ): Promise<PaginatedResponse<PlanMetadataDTO>> {
    const limit = Math.min(params.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const cursor = params.cursor;

    try {
      // Build where clause
      const whereClause = cursor
        ? and(eq(schema.plans.projectId, projectId), gt(schema.plans.id, cursor))
        : eq(schema.plans.projectId, projectId);

      // Build query with consistent ordering by id
      const query = this.db
        .select()
        .from(schema.plans)
        .where(whereClause)
        .orderBy(schema.plans.id)
        .limit(limit + 1); // Fetch one extra to determine hasMore

      const results = await query;

      // Determine if there are more items
      const hasMore = results.length > limit;
      const items = hasMore ? results.slice(0, limit) : results;

      // Get next cursor
      const lastItem = items[items.length - 1];
      const nextCursor = hasMore && lastItem ? lastItem.id : null;

      return {
        items: items.map((item) => this.toMetadataDTO(item)),
        pagination: {
          count: items.length,
          nextCursor,
          hasMore,
        },
      };
    } catch (error) {
      throw new ServiceError(
        ServiceErrorCode.DATABASE_ERROR,
        `Failed to list plans for project ${projectId}`,
        error,
      );
    }
  }

  /**
   * Get a plan by ID
   *
   * @param id - Plan ID
   * @returns Plan DTO or null if not found
   */
  async getById(id: string): Promise<PlanDTO | null> {
    try {
      const results = await this.db
        .select()
        .from(schema.plans)
        .where(eq(schema.plans.id, id))
        .limit(1);

      const plan = results[0];
      if (!plan) {
        return null;
      }

      return this.toDTO(plan);
    } catch (error) {
      throw new ServiceError(
        ServiceErrorCode.DATABASE_ERROR,
        `Failed to get plan ${id}`,
        error,
      );
    }
  }

  /**
   * Get a plan by ID within a specific project
   *
   * @param projectId - Project ID
   * @param planId - Plan ID
   * @returns Plan DTO or null if not found
   */
  async getByIdInProject(projectId: string, planId: string): Promise<PlanDTO | null> {
    try {
      const results = await this.db
        .select()
        .from(schema.plans)
        .where(and(eq(schema.plans.id, planId), eq(schema.plans.projectId, projectId)))
        .limit(1);

      const plan = results[0];
      if (!plan) {
        return null;
      }

      return this.toDTO(plan);
    } catch (error) {
      throw new ServiceError(
        ServiceErrorCode.DATABASE_ERROR,
        `Failed to get plan ${planId} in project ${projectId}`,
        error,
      );
    }
  }

  /**
   * Check if a plan with the given file hash exists
   *
   * @param fileHash - SHA-256 hash of the file
   * @param projectId - Optional project ID to scope the check
   * @returns Plan DTO if exists, null otherwise
   */
  async getByFileHash(fileHash: string, projectId?: string): Promise<PlanDTO | null> {
    try {
      // Build where clause
      const whereClause = projectId
        ? and(eq(schema.plans.fileHash, fileHash), eq(schema.plans.projectId, projectId))
        : eq(schema.plans.fileHash, fileHash);

      const results = await this.db
        .select()
        .from(schema.plans)
        .where(whereClause)
        .limit(1);

      const plan = results[0];
      if (!plan) {
        return null;
      }

      return this.toDTO(plan);
    } catch (error) {
      throw new ServiceError(
        ServiceErrorCode.DATABASE_ERROR,
        'Failed to check for duplicate plan',
        error,
      );
    }
  }

  /**
   * Create a new plan
   *
   * @param input - Plan creation data
   * @returns Created plan DTO
   */
  async create(input: CreatePlanInput): Promise<PlanDTO> {
    const id = randomUUID();
    const now = new Date();

    try {
      const result = await this.db
        .insert(schema.plans)
        .values({
          id,
          projectId: input.projectId,
          name: input.name,
          pageNumber: input.pageNumber ?? 1,
          pageCount: input.pageCount,
          filePath: input.filePath,
          fileSize: input.fileSize,
          fileHash: input.fileHash,
          width: input.width ?? null,
          height: input.height ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      const plan = result[0];
      if (!plan) {
        throw new ServiceError(ServiceErrorCode.DATABASE_ERROR, 'Failed to create plan');
      }
      return this.toDTO(plan);
    } catch (error) {
      // Check for foreign key violation
      if (
        error instanceof Error &&
        error.message.includes('FOREIGN KEY constraint failed')
      ) {
        throw new ServiceError(
          ServiceErrorCode.FOREIGN_KEY_VIOLATION,
          `Project ${input.projectId} does not exist`,
          error,
        );
      }

      throw new ServiceError(ServiceErrorCode.DATABASE_ERROR, 'Failed to create plan', error);
    }
  }

  /**
   * Update a plan
   *
   * @param id - Plan ID
   * @param input - Plan update data
   * @returns Updated plan DTO or null if not found
   */
  async update(id: string, input: UpdatePlanInput): Promise<PlanDTO | null> {
    // Check if plan exists
    const existing = await this.getById(id);
    if (!existing) {
      return null;
    }

    const now = new Date();

    try {
      const result = await this.db
        .update(schema.plans)
        .set({
          ...(input.name !== undefined && { name: input.name }),
          ...(input.pageNumber !== undefined && { pageNumber: input.pageNumber }),
          updatedAt: now,
        })
        .where(eq(schema.plans.id, id))
        .returning();

      const updated = result[0];
      if (!updated) {
        throw new ServiceError(ServiceErrorCode.DATABASE_ERROR, `Failed to update plan ${id}`);
      }
      return this.toDTO(updated);
    } catch (error) {
      throw new ServiceError(
        ServiceErrorCode.DATABASE_ERROR,
        `Failed to update plan ${id}`,
        error,
      );
    }
  }

  /**
   * Delete a plan
   * Note: This will cascade delete related stamps, locations, etc. per schema
   *
   * @param id - Plan ID
   * @returns Deleted plan DTO or null if not found
   */
  async delete(id: string): Promise<PlanDTO | null> {
    try {
      const [deleted] = await this.db
        .delete(schema.plans)
        .where(eq(schema.plans.id, id))
        .returning();

      if (!deleted) {
        return null;
      }

      return this.toDTO(deleted);
    } catch (error) {
      throw new ServiceError(
        ServiceErrorCode.DATABASE_ERROR,
        `Failed to delete plan ${id}`,
        error,
      );
    }
  }

  /**
   * Delete all plans for a project
   * Typically used during project deletion (though cascade handles this)
   *
   * @param projectId - Project ID
   * @returns Number of plans deleted
   */
  async deleteByProject(projectId: string): Promise<number> {
    try {
      const results = await this.db
        .delete(schema.plans)
        .where(eq(schema.plans.projectId, projectId))
        .returning();

      return results.length;
    } catch (error) {
      throw new ServiceError(
        ServiceErrorCode.DATABASE_ERROR,
        `Failed to delete plans for project ${projectId}`,
        error,
      );
    }
  }

  /**
   * Convert database row to full DTO (includes file path)
   *
   * @param row - Database row
   * @returns Plan DTO
   */
  private toDTO(row: typeof schema.plans.$inferSelect): PlanDTO {
    return {
      id: row.id,
      projectId: row.projectId,
      name: row.name,
      pageNumber: row.pageNumber,
      pageCount: row.pageCount,
      filePath: row.filePath,
      fileSize: row.fileSize,
      fileHash: row.fileHash,
      width: row.width,
      height: row.height,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Convert database row to metadata DTO (excludes file path)
   *
   * @param row - Database row
   * @returns Plan metadata DTO
   */
  private toMetadataDTO(row: typeof schema.plans.$inferSelect): PlanMetadataDTO {
    return {
      id: row.id,
      projectId: row.projectId,
      name: row.name,
      pageNumber: row.pageNumber,
      pageCount: row.pageCount,
      fileSize: row.fileSize,
      width: row.width,
      height: row.height,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

/**
 * Factory function to create plan service
 *
 * @param db - Database instance
 * @returns Plan service instance
 */
export function createPlanService(db: BetterSQLite3Database<typeof schema>): PlanService {
  return new PlanService(db);
}
