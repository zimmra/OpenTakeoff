/**
 * Data Service Types
 * Shared types and DTOs for data layer services
 */

// Import and re-export LocationDTO from locationService for consistency
import type { LocationDTO } from './locationService.js';
export type { LocationDTO };

/**
 * Pagination query parameters
 */
export interface PaginationParams {
  /**
   * Maximum number of items to return
   * @default 50
   */
  limit?: number | undefined;

  /**
   * Cursor for pagination (typically the ID of the last item from previous page)
   */
  cursor?: string | undefined;
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
 * Project DTO
 * Domain transfer object for projects
 */
export interface ProjectDTO {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Project create input
 */
export interface CreateProjectInput {
  name: string;
  description?: string | undefined;
}

/**
 * Project update input
 */
export interface UpdateProjectInput {
  name?: string | undefined;
  description?: string | null | undefined;
}

/**
 * Plan DTO
 * Domain transfer object for plans
 */
export interface PlanDTO {
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
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Plan metadata DTO
 * Lightweight version for listing without file paths
 */
export interface PlanMetadataDTO {
  id: string;
  projectId: string;
  name: string;
  pageNumber: number;
  pageCount: number;
  fileSize: number;
  width: number | null;
  height: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Plan create input
 */
export interface CreatePlanInput {
  projectId: string;
  name: string;
  pageNumber?: number;
  pageCount: number;
  filePath: string;
  fileSize: number;
  fileHash: string;
  width?: number;
  height?: number;
}

/**
 * Plan update input
 */
export interface UpdatePlanInput {
  name?: string;
  pageNumber?: number;
}

/**
 * Service error codes
 */
export enum ServiceErrorCode {
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  INVALID_INPUT = 'INVALID_INPUT',
  FOREIGN_KEY_VIOLATION = 'FOREIGN_KEY_VIOLATION',
  DATABASE_ERROR = 'DATABASE_ERROR',
}

/**
 * Device DTO
 * Domain transfer object for devices
 */
export interface DeviceDTO {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  color: string | null;
  iconKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Device create input
 */
export interface CreateDeviceInput {
  projectId: string;
  name: string;
  description?: string | undefined;
  color?: string | undefined;
  iconKey?: string | undefined;
}

/**
 * Device update input
 */
export interface UpdateDeviceInput {
  name?: string | undefined;
  description?: string | null | undefined;
  color?: string | null | undefined;
  iconKey?: string | null | undefined;
}

/**
 * Stamp position in world coordinate space
 * Positions are stored in PDF points (72 points = 1 inch)
 * The frontend Konva Stage transform handles zoom/pan automatically
 */
export interface StampPosition {
  /** Page number (1-indexed) */
  page?: number | undefined;
  /** X coordinate in world space (PDF points) */
  x: number;
  /** Y coordinate in world space (PDF points) */
  y: number;
  /** @deprecated Scale is no longer stored; frontend Stage transform handles zoom */
  scale?: number | undefined;
}

/**
 * Stamp DTO
 * Domain transfer object for stamps
 */
export interface StampDTO {
  id: string;
  planId: string;
  deviceId: string;
  locationId: string | null;
  position: StampPosition;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Stamp create input
 */
export interface CreateStampInput {
  planId: string;
  deviceId: string;
  locationId?: string | undefined;
  position: StampPosition;
}

/**
 * Stamp update input
 */
export interface UpdateStampInput {
  position?: StampPosition | undefined;
  locationId?: string | null | undefined;
  updatedAt?: Date | undefined; // For optimistic locking
}

/**
 * Stamp revision DTO
 */
export interface StampRevisionDTO {
  id: string;
  stampId: string;
  type: 'create' | 'update' | 'delete';
  snapshot: StampDTO | null;
  createdAt: Date;
}

/**
 * Service error
 */
export class ServiceError extends Error {
  constructor(
    public code: ServiceErrorCode,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

/**
 * Optimistic lock error
 */
export class OptimisticLockError extends ServiceError {
  constructor(message = 'Resource has been modified by another user') {
    super(ServiceErrorCode.INVALID_INPUT, message);
    this.name = 'OptimisticLockError';
  }
}

/**
 * Location DTO
 * Domain transfer object for locations
 * (imported and re-exported from locationService.ts)
 */

/**
 * Location revision DTO
 */
export interface LocationRevisionDTO {
  id: string;
  locationId: string;
  type: 'create' | 'update' | 'delete';
  snapshot: LocationDTO | null;
  createdAt: Date;
}

/**
 * History entry combining stamps and locations
 */
export interface HistoryEntryDTO {
  id: string;
  entityId: string;
  entityType: 'stamp' | 'location';
  type: 'create' | 'update' | 'delete';
  snapshot: StampDTO | LocationDTO | null;
  createdAt: Date;
}

/**
 * Undo/Redo action result
 */
export interface HistoryActionResult {
  success: boolean;
  entityType: 'stamp' | 'location';
  entityId: string;
  action: 'undo' | 'redo';
  restoredState?: StampDTO | LocationDTO;
}
