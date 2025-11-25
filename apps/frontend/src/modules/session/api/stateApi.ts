/**
 * Session State API Client
 * Typed client for project state version checks and autosave updates
 *
 * @example
 * ```typescript
 * import { stateApi } from './stateApi';
 *
 * // Check version
 * const versionInfo = await stateApi.getStateVersion('project-123');
 * console.log('Server version:', versionInfo.version);
 *
 * // Update state
 * try {
 *   const result = await stateApi.updateState('project-123', {
 *     projectId: 'project-123',
 *     planId: 'plan-456',
 *     schemaVersion: '1.0.0',
 *     timestamp: Date.now(),
 *     unsyncedChanges: [],
 *   });
 *   console.log('State synced at:', result.syncedAt);
 * } catch (error) {
 *   if (error instanceof StateApiError) {
 *     if (error.code === 'VERSION_MISMATCH') {
 *       console.error('Version mismatch:', error.serverVersion);
 *     } else if (error.code === 'STATE_CONFLICT') {
 *       console.error('Conflicts:', error.conflictingChanges);
 *     }
 *   }
 * }
 * ```
 */

import { apiClient } from '../../../lib/api';
import type {
  StateVersionResponse,
  StateUpdateResult,
  StateApiErrorCode,
  AutosavePayload,
  UnsyncedChange,
} from '../types';
import { StateApiError } from '../types';

/**
 * Backend error response structure
 */
interface BackendErrorResponse {
  code?: string;
  error?: string;
  message?: string;
  version?: string;
  conflictingChanges?: unknown[];
}

/**
 * Parse backend error into StateApiError
 */
function parseError(
  error: unknown,
  defaultCode: StateApiErrorCode = 'UNKNOWN'
): StateApiError {
  // Network errors (offline, timeout, etc.)
  if (!navigator.onLine) {
    return new StateApiError(
      'NETWORK_ERROR',
      0,
      'No internet connection'
    );
  }

  // Handle Error objects with response data
  if (error && typeof error === 'object') {
    // Check if it's an HTTP error with response data
    if ('message' in error && typeof error.message === 'string') {
      const message = error.message;

      // Try to extract HTTP status from error message (e.g., "HTTP 400", "HTTP 404")
      const httpStatusMatch = /HTTP (\d+)/.exec(message);
      const httpStatus = httpStatusMatch?.[1]
        ? parseInt(httpStatusMatch[1], 10)
        : 500;

      // Try to parse JSON from error message or extract structured data
      let errorData: BackendErrorResponse | null = null;

      // If the error message contains JSON-like content, try to parse it
      try {
        const jsonMatch = /\{.*\}/.exec(message);
        if (jsonMatch) {
          errorData = JSON.parse(jsonMatch[0]) as BackendErrorResponse;
        }
      } catch {
        // Not JSON, continue with plain message
      }

      if (errorData) {
        const code = errorData.code;

        // Map backend error codes to StateApiError codes
        if (code === 'VERSION_MISMATCH') {
          return new StateApiError(
            'VERSION_MISMATCH',
            httpStatus,
            errorData.error ?? errorData.message ?? 'Schema version mismatch',
            errorData.version ?? undefined,
            undefined
          );
        }

        if (code === 'STATE_CONFLICT') {
          return new StateApiError(
            'STATE_CONFLICT',
            httpStatus,
            errorData.error ?? errorData.message ?? 'State conflict detected',
            errorData.version ?? undefined,
            errorData.conflictingChanges as UnsyncedChange[] | undefined
          );
        }

        if (code === 'INVALID_INPUT') {
          return new StateApiError(
            'INVALID_INPUT',
            httpStatus,
            errorData.error ?? errorData.message ?? 'Invalid input'
          );
        }
      }

      // Handle HTTP status codes
      if (httpStatus === 404) {
        return new StateApiError(
          'NOT_FOUND',
          httpStatus,
          'Project state not found'
        );
      }

      if (httpStatus === 400) {
        return new StateApiError(
          'INVALID_INPUT',
          httpStatus,
          message
        );
      }

      // Generic 5xx server errors - use default code (UNKNOWN typically)
      if (httpStatus >= 500) {
        return new StateApiError(
          defaultCode,
          httpStatus,
          message
        );
      }

      // Default case with extracted status
      return new StateApiError(
        defaultCode,
        httpStatus,
        message
      );
    }
  }

  // Fallback for unknown errors
  const message = error instanceof Error ? error.message : 'Unknown error occurred';
  return new StateApiError(defaultCode, 500, message);
}

/**
 * State API Client
 * Provides typed methods for session state operations
 */
export const stateApi = {
  /**
   * Get current schema version from server
   *
   * @param projectId - Project ID
   * @returns Version information
   * @throws {StateApiError} On network error, not found, or other failures
   *
   * @example
   * ```typescript
   * const versionInfo = await stateApi.getStateVersion('project-123');
   * console.log('Server version:', versionInfo.version);
   * ```
   */
  async getStateVersion(projectId: string): Promise<StateVersionResponse> {
    try {
      const response = await apiClient.get<StateVersionResponse>(
        `/projects/${projectId}/state/version`
      );
      return response;
    } catch (error: unknown) {
      throw parseError(error, 'NETWORK_ERROR');
    }
  },

  /**
   * Update project state with pending changes
   *
   * @param projectId - Project ID
   * @param payload - Autosave payload with unsynced changes
   * @returns Update result with sync metadata
   * @throws {StateApiError} On version mismatch, conflict, or other failures
   *
   * @example
   * ```typescript
   * try {
   *   const result = await stateApi.updateState('project-123', {
   *     projectId: 'project-123',
   *     planId: 'plan-456',
   *     schemaVersion: '1.0.0',
   *     timestamp: Date.now(),
   *     unsyncedChanges: [],
   *   });
   *   console.log('Synced at:', result.syncedAt);
   * } catch (error) {
   *   if (error instanceof StateApiError && error.code === 'VERSION_MISMATCH') {
   *     console.error('Version mismatch, server version:', error.serverVersion);
   *   }
   * }
   * ```
   */
  async updateState(
    projectId: string,
    payload: AutosavePayload
  ): Promise<StateUpdateResult> {
    try {
      const response = await apiClient.put<StateUpdateResult>(
        `/projects/${projectId}/state`,
        payload
      );

      // Check for conflicts in successful response
      if (response.conflictingChanges && response.conflictingChanges.length > 0) {
        throw new StateApiError(
          'STATE_CONFLICT',
          200,
          'State updated but conflicts detected',
          response.schemaVersion,
          response.conflictingChanges
        );
      }

      return response;
    } catch (error: unknown) {
      // If it's already a StateApiError, re-throw
      if (error instanceof StateApiError) {
        throw error;
      }

      // Otherwise, parse and throw
      throw parseError(error, 'UNKNOWN');
    }
  },
};
