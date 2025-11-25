/**
 * Projects & Plans Types
 * TypeScript models matching backend API schema
 * Mirrors apps/backend/src/services/data/types.ts with Date fields as strings
 */

/**
 * Pagination query parameters
 */
export interface PaginationParams {
  /**
   * Maximum number of items to return
   * @default 50
   */
  limit?: number;

  /**
   * Cursor for pagination (typically the ID of the last item from previous page)
   */
  cursor?: string;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  /**
   * Array of items for this page
   */
  items: T[];

  /**
   * Pagination metadata
   */
  pagination: {
    /**
     * Number of items in this page
     */
    count: number;

    /**
     * Cursor for the next page (null if no more items)
     */
    nextCursor: string | null;

    /**
     * Whether there are more items available
     */
    hasMore: boolean;
  };
}

/**
 * Project
 * Frontend representation with string dates
 */
export interface Project {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Project create input
 */
export interface CreateProjectInput {
  name: string;
  description?: string;
}

/**
 * Project update input
 */
export interface UpdateProjectInput {
  name?: string;
  description?: string | null;
}

/**
 * Paginated projects response
 */
export type PaginatedProjectsResponse = PaginatedResponse<Project>;

/**
 * Plan
 * Frontend representation with string dates
 */
export interface Plan {
  id: string;
  projectId: string;
  name: string;
  pageNumber: number;
  pageCount: number;
  filePath: string;
  fileSize: number;
  fileHash: string;
  width: number | null;
  height: number | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Plan metadata (lightweight version for listing)
 */
export interface PlanMetadata {
  id: string;
  projectId: string;
  name: string;
  pageNumber: number;
  pageCount: number;
  fileSize: number;
  width: number | null;
  height: number | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Plan upload response
 * Returned when uploading a PDF plan
 */
export interface PlanUploadResponse {
  plan: Plan;
}

/**
 * Paginated plans response
 */
export type PaginatedPlansResponse = PaginatedResponse<Plan>;
