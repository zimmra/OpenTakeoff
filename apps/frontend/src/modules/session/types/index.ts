/**
 * Session Persistence Types
 * Type definitions for autosave, offline caching, and session state management
 */

import type { Stamp } from '../../stamps/types';
import type { Location } from '../../locations/types';

/**
 * Unsynced change types
 */
export type ChangeType = 'create' | 'update' | 'delete';

/**
 * Entity types that can be synced
 */
export type EntityType = 'stamp' | 'location';

/**
 * Unsynced change record
 * Represents a pending mutation that hasn't been persisted to the backend
 */
export interface UnsyncedChange {
  id: string;
  entityType: EntityType;
  changeType: ChangeType;
  entityId: string;
  timestamp: number;
  data: Stamp | Location | null; // null for delete operations
}

/**
 * Project session state
 * Complete state snapshot for a project session including pending changes
 */
export interface ProjectSessionState {
  projectId: string;
  planId: string | null;
  schemaVersion: string;
  lastSyncedAt: number;
  unsyncedChanges: UnsyncedChange[];
  stamps: Stamp[];
  locations: Location[];
}

/**
 * Autosave payload
 * Summarized data sent to PUT /projects/:id/state
 */
export interface AutosavePayload {
  projectId: string;
  planId: string | null;
  schemaVersion: string;
  timestamp: number;
  unsyncedChanges: UnsyncedChange[];
}

/**
 * Autosave response from backend
 */
export interface AutosaveResponse {
  success: boolean;
  projectId: string;
  syncedAt: number;
  schemaVersion: string;
  conflictingChanges?: UnsyncedChange[];
}

/**
 * IndexedDB cache record
 * Stored locally for offline fallback and recovery
 */
export interface CachedSessionState {
  projectId: string;
  planId: string | null;
  schemaVersion: string;
  cachedAt: number;
  sessionState: ProjectSessionState;
}

/**
 * Version drift detection
 */
export interface SchemaVersionInfo {
  version: string;
  timestamp: number;
  migrations?: string[];
}

/**
 * Sync status for UI feedback
 */
export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error' | 'conflict';

/**
 * Sync error details
 */
export interface SyncError {
  code: 'NETWORK_ERROR' | 'VERSION_MISMATCH' | 'CONFLICT' | 'INVALID_INPUT' | 'UNKNOWN';
  message: string;
  timestamp: number;
  retryable: boolean;
}

/**
 * Retry strategy configuration
 */
export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

/**
 * Default retry configuration
 * Exponential backoff: 1s, 2s, 4s, 8s, 16s (max)
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 5,
  initialDelayMs: 1000,
  maxDelayMs: 16000,
  backoffMultiplier: 2,
};

/**
 * Autosave configuration
 */
export interface AutosaveConfig {
  intervalMs: number;
  enabled: boolean;
  retryConfig: RetryConfig;
}

/**
 * Default autosave configuration
 */
export const DEFAULT_AUTOSAVE_CONFIG: AutosaveConfig = {
  intervalMs: 5000, // 5 seconds
  enabled: true,
  retryConfig: DEFAULT_RETRY_CONFIG,
};

/**
 * Session manager state interface
 * Used by the session store to track sync status
 */
export interface SessionManagerState {
  syncStatus: SyncStatus;
  lastSyncedAt: number | null;
  lastSyncError: SyncError | null;
  pendingChanges: number;
  isOnline: boolean;
  schemaVersion: string;
  serverSchemaVersion: string | null;
  hasVersionMismatch: boolean;
}

/**
 * State API Types
 * Types for the session state API client
 */

/**
 * Response from GET /projects/:id/state/version
 * Used to check schema version without retrieving full state
 */
export interface StateVersionResponse {
  version: string;
  timestamp: number;
}

/**
 * Response from PUT /projects/:id/state
 * Extends AutosaveResponse with additional state API metadata
 */
export interface StateUpdateResult {
  success: boolean;
  projectId: string;
  syncedAt: number;
  schemaVersion: string;
  conflictingChanges?: UnsyncedChange[];
}

/**
 * State API error codes
 */
export type StateApiErrorCode =
  | 'VERSION_MISMATCH'
  | 'STATE_CONFLICT'
  | 'NETWORK_ERROR'
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'UNKNOWN';

/**
 * Discriminated union error for state API operations
 * Provides structured error information with HTTP status and server metadata
 */
export class StateApiError extends Error {
  constructor(
    public readonly code: StateApiErrorCode,
    public readonly httpStatus: number,
    message: string,
    public readonly serverVersion?: string,
    public readonly conflictingChanges?: UnsyncedChange[]
  ) {
    super(message);
    this.name = 'StateApiError';
    Object.setPrototypeOf(this, StateApiError.prototype);
  }
}
