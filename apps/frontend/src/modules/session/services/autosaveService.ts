/**
 * Autosave Service
 * Handles flushing pending changes to the backend with retry logic
 * Uses the typed stateApi client for state updates with explicit conflict handling
 */

import { stateApi } from '../api/stateApi';
import { StateApiError } from '../types';
import { useSessionStore } from '../state/useSessionStore';
import type {
  AutosavePayload,
  StateUpdateResult,
  UnsyncedChange,
  SyncError,
} from '../types';

const CURRENT_SCHEMA_VERSION = '1.0.0';

/**
 * Build autosave payload
 */
function buildPayload(params: {
  projectId: string;
  planId: string | null;
  unsyncedChanges: UnsyncedChange[];
}): AutosavePayload {
  return {
    projectId: params.projectId,
    planId: params.planId,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    timestamp: Date.now(),
    unsyncedChanges: params.unsyncedChanges,
  };
}

/**
 * Flush pending changes to backend
 * Uses stateApi.updateState for typed, consistent API communication
 *
 * Flow:
 * 1. Build payload from current state
 * 2. Call stateApi.updateState
 * 3. On success: clear unsynced changes, update sync time
 * 4. On VERSION_MISMATCH: fetch latest version, set non-retryable error
 * 5. On STATE_CONFLICT: set conflict status, preserve unsynced changes for resolution
 * 6. On other errors: categorize and set appropriate retry strategy
 */
async function flush(params: {
  projectId: string;
  planId: string | null;
  unsyncedChanges: UnsyncedChange[];
}): Promise<StateUpdateResult> {
  const { setSyncStatus, setLastSyncedAt, setLastSyncError, clearUnsyncedChanges, setServerSchemaVersion, setConflictingChanges } =
    useSessionStore.getState();

  try {
    // Set syncing status
    setSyncStatus('syncing');
    setLastSyncError(null);

    // Build payload
    const payload = buildPayload(params);

    // Make API call using stateApi client
    const response = await stateApi.updateState(params.projectId, payload);

    // Handle successful sync
    if (response.success) {
      clearUnsyncedChanges();
      setLastSyncedAt(response.syncedAt);
      setSyncStatus('synced');

      return response;
    } else {
      throw new Error('Autosave failed: success = false');
    }
  } catch (error: unknown) {
    // Handle structured StateApiError
    if (error instanceof StateApiError) {
      const syncError: SyncError = {
        code: error.code as SyncError['code'],
        message: error.message,
        timestamp: Date.now(),
        retryable: true,
      };

      // Handle VERSION_MISMATCH
      if (error.code === 'VERSION_MISMATCH') {
        syncError.retryable = false;

        // Update server version in store if available
        if (error.serverVersion) {
          setServerSchemaVersion(error.serverVersion);
        } else {
          // Fetch latest version if not included in error
          try {
            const versionInfo = await stateApi.getStateVersion(params.projectId);
            setServerSchemaVersion(versionInfo.version);
          } catch (versionError) {
            console.error('[Autosave] Failed to fetch server version after mismatch:', versionError);
          }
        }

        setLastSyncError(syncError);
        setSyncStatus('error');
        throw error;
      }

      // Handle STATE_CONFLICT
      if (error.code === 'STATE_CONFLICT') {
        syncError.code = 'CONFLICT';
        syncError.retryable = false;

        // Set conflict status (do NOT clear unsynced changes - they need resolution)
        setLastSyncError(syncError);
        setSyncStatus('conflict');

        // Store conflicting changes for UI resolution
        if (error.conflictingChanges) {
          setConflictingChanges(error.conflictingChanges);
        }

        throw error;
      }

      // Handle other API errors
      if (error.code === 'INVALID_INPUT') {
        syncError.retryable = false;
        setSyncStatus('error');
      } else if (error.code === 'NETWORK_ERROR') {
        syncError.retryable = true;
        if (!navigator.onLine) {
          setSyncStatus('offline');
        } else {
          setSyncStatus('error');
        }
      } else {
        // UNKNOWN, NOT_FOUND, etc.
        syncError.retryable = false;
        setSyncStatus('error');
      }

      setLastSyncError(syncError);

      throw error;
    }

    // Handle non-StateApiError (shouldn't happen, but be defensive)
    const syncError: SyncError = {
      code: 'UNKNOWN',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: Date.now(),
      retryable: true,
    };

    if (!navigator.onLine) {
      syncError.code = 'NETWORK_ERROR';
      syncError.message = 'No internet connection';
      setSyncStatus('offline');
    } else {
      setSyncStatus('error');
    }

    setLastSyncError(syncError);
    throw error;
  }
}

/**
 * Autosave Service
 */
export const autosaveService = {
  buildPayload,
  flush,
};
