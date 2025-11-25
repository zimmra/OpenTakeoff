/**
 * Autosave Service Tests
 * Comprehensive test coverage for autosave conflict handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { autosaveService } from '../autosaveService';
import { stateApi } from '../../api/stateApi';
import { useSessionStore } from '../../state/useSessionStore';
import { StateApiError } from '../../types';
import type { StateUpdateResult, UnsyncedChange } from '../../types';

// Mock the stateApi module
vi.mock('../../api/stateApi', () => ({
  stateApi: {
    updateState: vi.fn(),
    getStateVersion: vi.fn(),
  },
}));

describe('autosaveService', () => {
  const projectId = 'project-123';
  const planId = 'plan-456';
  const mockChanges: UnsyncedChange[] = [
    {
      id: 'change-1',
      entityType: 'stamp',
      changeType: 'create',
      entityId: 'stamp-1',
      timestamp: Date.now(),
      data: null,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset session store to clean state
    const store = useSessionStore.getState();
    store.clearUnsyncedChanges();
    store.clearConflictingChanges();
    store.setSyncStatus('synced');
    store.setLastSyncError(null);
    store.setServerSchemaVersion(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('flush - success path', () => {
    it('should successfully flush changes and update store', async () => {
      const mockResponse: StateUpdateResult = {
        success: true,
        projectId,
        syncedAt: Date.now(),
        schemaVersion: '1.0.0',
      };

      vi.mocked(stateApi.updateState).mockResolvedValue(mockResponse);

      await autosaveService.flush({
        projectId,
        planId,
        unsyncedChanges: mockChanges,
      });

      const store = useSessionStore.getState();

      expect(stateApi.updateState).toHaveBeenCalledWith(
        projectId,
        expect.objectContaining({
          projectId,
          planId,
          schemaVersion: '1.0.0',
          unsyncedChanges: mockChanges,
        })
      );

      expect(store.syncStatus).toBe('synced');
      expect(store.lastSyncedAt).toBe(mockResponse.syncedAt);
      expect(store.unsyncedChanges).toEqual([]);
      expect(store.lastSyncError).toBeNull();
    });
  });

  describe('flush - VERSION_MISMATCH handling', () => {
    it('should fetch server version and set non-retryable error on VERSION_MISMATCH', async () => {
      const serverVersion = '2.0.0';
      const versionMismatchError = new StateApiError(
        'VERSION_MISMATCH',
        400,
        'Schema version mismatch',
        serverVersion
      );

      vi.mocked(stateApi.updateState).mockRejectedValue(versionMismatchError);

      await expect(
        autosaveService.flush({
          projectId,
          planId,
          unsyncedChanges: mockChanges,
        })
      ).rejects.toThrow(StateApiError);

      const store = useSessionStore.getState();

      expect(store.syncStatus).toBe('error');
      expect(store.serverSchemaVersion).toBe(serverVersion);
      expect(store.lastSyncError).toMatchObject({
        code: 'VERSION_MISMATCH',
        retryable: false,
      });

      // Should NOT have cleared unsynced changes
      expect(store.unsyncedChanges).toEqual([]);
    });

    it('should fetch version from API when not included in error', async () => {
      const serverVersion = '2.0.0';
      const versionMismatchError = new StateApiError(
        'VERSION_MISMATCH',
        400,
        'Schema version mismatch'
        // No serverVersion included
      );

      vi.mocked(stateApi.updateState).mockRejectedValue(versionMismatchError);
      vi.mocked(stateApi.getStateVersion).mockResolvedValue({
        version: serverVersion,
        timestamp: Date.now(),
      });

      await expect(
        autosaveService.flush({
          projectId,
          planId,
          unsyncedChanges: mockChanges,
        })
      ).rejects.toThrow(StateApiError);

      expect(stateApi.getStateVersion).toHaveBeenCalledWith(projectId);

      const store = useSessionStore.getState();
      expect(store.serverSchemaVersion).toBe(serverVersion);
    });
  });

  describe('flush - STATE_CONFLICT handling', () => {
    it('should set conflict status and store conflicting changes', async () => {
      const conflictingChanges: UnsyncedChange[] = [
        {
          id: 'conflict-1',
          entityType: 'location',
          changeType: 'update',
          entityId: 'location-1',
          timestamp: Date.now(),
          data: null,
        },
      ];

      const conflictError = new StateApiError(
        'STATE_CONFLICT',
        400,
        'State conflict detected',
        undefined,
        conflictingChanges
      );

      vi.mocked(stateApi.updateState).mockRejectedValue(conflictError);

      await expect(
        autosaveService.flush({
          projectId,
          planId,
          unsyncedChanges: mockChanges,
        })
      ).rejects.toThrow(StateApiError);

      const store = useSessionStore.getState();

      expect(store.syncStatus).toBe('conflict');
      expect(store.conflictingChanges).toEqual(conflictingChanges);
      expect(store.lastSyncError).toMatchObject({
        code: 'CONFLICT',
        retryable: false,
      });

      // Should NOT have cleared unsynced changes - they need resolution
      expect(store.unsyncedChanges).toEqual([]);
    });

    it('should handle conflict without conflicting changes array', async () => {
      const conflictError = new StateApiError(
        'STATE_CONFLICT',
        400,
        'State conflict detected'
        // No conflictingChanges
      );

      vi.mocked(stateApi.updateState).mockRejectedValue(conflictError);

      await expect(
        autosaveService.flush({
          projectId,
          planId,
          unsyncedChanges: mockChanges,
        })
      ).rejects.toThrow(StateApiError);

      const store = useSessionStore.getState();

      expect(store.syncStatus).toBe('conflict');
      // Should not have set conflicting changes since none were provided
      expect(store.conflictingChanges).toEqual([]);
    });
  });

  describe('flush - NETWORK_ERROR handling', () => {
    it('should set offline status when navigator.onLine is false', async () => {
      const networkError = new StateApiError(
        'NETWORK_ERROR',
        0,
        'No internet connection'
      );

      // Mock navigator.onLine
      vi.stubGlobal('navigator', { onLine: false });

      vi.mocked(stateApi.updateState).mockRejectedValue(networkError);

      await expect(
        autosaveService.flush({
          projectId,
          planId,
          unsyncedChanges: mockChanges,
        })
      ).rejects.toThrow(StateApiError);

      const store = useSessionStore.getState();

      expect(store.syncStatus).toBe('offline');
      expect(store.lastSyncError).toMatchObject({
        code: 'NETWORK_ERROR',
        retryable: true,
      });
    });

    it('should set error status when online but network fails', async () => {
      const networkError = new StateApiError(
        'NETWORK_ERROR',
        500,
        'Network request failed'
      );

      vi.stubGlobal('navigator', { onLine: true });

      vi.mocked(stateApi.updateState).mockRejectedValue(networkError);

      await expect(
        autosaveService.flush({
          projectId,
          planId,
          unsyncedChanges: mockChanges,
        })
      ).rejects.toThrow(StateApiError);

      const store = useSessionStore.getState();

      expect(store.syncStatus).toBe('error');
      expect(store.lastSyncError).toMatchObject({
        code: 'NETWORK_ERROR',
        retryable: true,
      });
    });
  });

  describe('flush - INVALID_INPUT handling', () => {
    it('should set non-retryable error for INVALID_INPUT', async () => {
      const invalidInputError = new StateApiError(
        'INVALID_INPUT',
        400,
        'Missing required field'
      );

      vi.mocked(stateApi.updateState).mockRejectedValue(invalidInputError);

      await expect(
        autosaveService.flush({
          projectId,
          planId,
          unsyncedChanges: mockChanges,
        })
      ).rejects.toThrow(StateApiError);

      const store = useSessionStore.getState();

      expect(store.syncStatus).toBe('error');
      expect(store.lastSyncError).toMatchObject({
        code: 'INVALID_INPUT',
        retryable: false,
      });
    });
  });

  describe('flush - UNKNOWN error handling', () => {
    it('should handle unknown StateApiError', async () => {
      const unknownError = new StateApiError('UNKNOWN', 500, 'Unknown error');

      vi.mocked(stateApi.updateState).mockRejectedValue(unknownError);

      await expect(
        autosaveService.flush({
          projectId,
          planId,
          unsyncedChanges: mockChanges,
        })
      ).rejects.toThrow(StateApiError);

      const store = useSessionStore.getState();

      expect(store.syncStatus).toBe('error');
      expect(store.lastSyncError).toMatchObject({
        code: 'UNKNOWN',
        retryable: false,
      });
    });

    it('should handle non-StateApiError errors', async () => {
      const genericError = new Error('Generic error');

      vi.stubGlobal('navigator', { onLine: true });
      vi.mocked(stateApi.updateState).mockRejectedValue(genericError);

      await expect(
        autosaveService.flush({
          projectId,
          planId,
          unsyncedChanges: mockChanges,
        })
      ).rejects.toThrow();

      const store = useSessionStore.getState();

      expect(store.syncStatus).toBe('error');
      expect(store.lastSyncError).toMatchObject({
        code: 'UNKNOWN',
        message: 'Generic error',
        retryable: true,
      });
    });
  });

  describe('buildPayload', () => {
    it('should build payload with correct schema version and timestamp', () => {
      const payload = autosaveService.buildPayload({
        projectId,
        planId,
        unsyncedChanges: mockChanges,
      });

      expect(payload).toMatchObject({
        projectId,
        planId,
        schemaVersion: '1.0.0',
        unsyncedChanges: mockChanges,
      });

      expect(payload.timestamp).toBeGreaterThan(0);
      expect(typeof payload.timestamp).toBe('number');
    });

    it('should handle null planId', () => {
      const payload = autosaveService.buildPayload({
        projectId,
        planId: null,
        unsyncedChanges: mockChanges,
      });

      expect(payload.planId).toBeNull();
    });
  });
});
