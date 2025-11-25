/**
 * Project Service
 * Data layer for project CRUD operations
 */

import { eq, gt } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../../db/schema.js';
import type {
  ProjectDTO,
  CreateProjectInput,
  UpdateProjectInput,
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
 * Project Service
 * Encapsulates all project data access logic
 */
export class ProjectService {
  constructor(private db: BetterSQLite3Database<typeof schema>) {}

  /**
   * List projects with pagination
   *
   * @param params - Pagination parameters
   * @returns Paginated list of projects
   */
  async list(params: PaginationParams = {}): Promise<PaginatedResponse<ProjectDTO>> {
    const limit = Math.min(params.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const cursor = params.cursor;

    try {
      // Build where clause
      const whereClause = cursor ? gt(schema.projects.id, cursor) : undefined;

      // Build query with consistent ordering by id
      const queryBuilder = this.db.select().from(schema.projects);

      const query = whereClause
        ? queryBuilder.where(whereClause).orderBy(schema.projects.id).limit(limit + 1)
        : queryBuilder.orderBy(schema.projects.id).limit(limit + 1);

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
        'Failed to list projects',
        error,
      );
    }
  }

  /**
   * Get a project by ID
   *
   * @param id - Project ID
   * @returns Project DTO or null if not found
   */
  async getById(id: string): Promise<ProjectDTO | null> {
    try {
      const results = await this.db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.id, id))
        .limit(1);

      const project = results[0];
      if (!project) {
        return null;
      }

      return this.toDTO(project);
    } catch (error) {
      throw new ServiceError(
        ServiceErrorCode.DATABASE_ERROR,
        `Failed to get project ${id}`,
        error,
      );
    }
  }

  /**
   * Create a new project
   *
   * @param input - Project creation data
   * @returns Created project DTO
   */
  async create(input: CreateProjectInput): Promise<ProjectDTO> {
    const id = randomUUID();
    const now = new Date();

    try {
      const result = await this.db
        .insert(schema.projects)
        .values({
          id,
          name: input.name,
          description: input.description ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      const project = result[0];
      if (!project) {
        throw new ServiceError(ServiceErrorCode.DATABASE_ERROR, 'Failed to create project');
      }
      return this.toDTO(project);
    } catch (error) {
      throw new ServiceError(
        ServiceErrorCode.DATABASE_ERROR,
        'Failed to create project',
        error,
      );
    }
  }

  /**
   * Update a project
   *
   * @param id - Project ID
   * @param input - Project update data
   * @returns Updated project DTO or null if not found
   */
  async update(id: string, input: UpdateProjectInput): Promise<ProjectDTO | null> {
    // Check if project exists
    const existing = await this.getById(id);
    if (!existing) {
      return null;
    }

    const now = new Date();

    try {
      const result = await this.db
        .update(schema.projects)
        .set({
          ...(input.name !== undefined && { name: input.name }),
          ...(input.description !== undefined && { description: input.description }),
          updatedAt: now,
        })
        .where(eq(schema.projects.id, id))
        .returning();

      const updated = result[0];
      if (!updated) {
        throw new ServiceError(ServiceErrorCode.DATABASE_ERROR, `Failed to update project ${id}`);
      }
      return this.toDTO(updated);
    } catch (error) {
      throw new ServiceError(
        ServiceErrorCode.DATABASE_ERROR,
        `Failed to update project ${id}`,
        error,
      );
    }
  }

  /**
   * Delete a project
   * Note: This will cascade delete all related plans, devices, etc. per schema
   *
   * @param id - Project ID
   * @returns True if deleted, false if not found
   */
  async delete(id: string): Promise<boolean> {
    try {
      const result = await this.db
        .delete(schema.projects)
        .where(eq(schema.projects.id, id))
        .returning();

      return result.length > 0;
    } catch (error) {
      throw new ServiceError(
        ServiceErrorCode.DATABASE_ERROR,
        `Failed to delete project ${id}`,
        error,
      );
    }
  }

  /**
   * Convert database row to DTO
   *
   * @param row - Database row
   * @returns Project DTO
   */
  private toDTO(row: typeof schema.projects.$inferSelect): ProjectDTO {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

/**
 * Factory function to create project service
 *
 * @param db - Database instance
 * @returns Project service instance
 */
export function createProjectService(
  db: BetterSQLite3Database<typeof schema>,
): ProjectService {
  return new ProjectService(db);
}
