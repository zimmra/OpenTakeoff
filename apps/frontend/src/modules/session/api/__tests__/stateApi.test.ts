/**
 * State API Client Tests
 * Comprehensive test coverage for session state API operations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { stateApi } from '../stateApi';
import { StateApiError } from '../../types';
import { apiClient } from '../../../../lib/api';
import type { StateVersionResponse, StateUpdateResult, AutosavePayload } from '../../types';

// Mock the API client
vi.mock('../../../../lib/api', () => ({
  apiClient: {
    get: vi.fn(),
    put: vi.fn(),
  },
}));

describe('stateApi', () => {
  const projectId = 'project-123';

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset navigator.onLine to default
    vi.stubGlobal('navigator', { onLine: true });
  });

  describe('getStateVersion', () => {
    it('should fetch version information successfully', async () => {
      const mockResponse: StateVersionResponse = {
        version: '1.0.0',
        timestamp: Date.now(),
      };

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      const result = await stateApi.getStateVersion(projectId);

      expect(apiClient.get).toHaveBeenCalledWith(
        `/projects/${projectId}/state/version`
      );
      expect(result).toEqual(mockResponse);
    });

    it('should throw StateApiError on network failure', async () => {
      const error = new Error('HTTP 500');
      vi.mocked(apiClient.get).mockRejectedValue(error);

      const promise = stateApi.getStateVersion(projectId);
      await expect(promise).rejects.toThrow(StateApiError);

      try {
        await promise;
      } catch (err) {
        expect(err).toBeInstanceOf(StateApiError);
        expect((err as StateApiError).code).toBe('NETWORK_ERROR');
        expect((err as StateApiError).httpStatus).toBe(500);
      }
    });

    it('should throw StateApiError with NOT_FOUND when project not found', async () => {
      const error = new Error('HTTP 404');
      vi.mocked(apiClient.get).mockRejectedValue(error);

      const promise = stateApi.getStateVersion(projectId);
      await expect(promise).rejects.toThrow(StateApiError);

      try {
        await promise;
      } catch (err) {
        expect(err).toBeInstanceOf(StateApiError);
        expect((err as StateApiError).code).toBe('NOT_FOUND');
        expect((err as StateApiError).httpStatus).toBe(404);
      }
    });

    it('should handle offline scenario', async () => {
      vi.stubGlobal('navigator', { onLine: false });
      const error = new Error('Network error');
      vi.mocked(apiClient.get).mockRejectedValue(error);

      const promise = stateApi.getStateVersion(projectId);
      await expect(promise).rejects.toThrow(StateApiError);

      try {
        await promise;
      } catch (err) {
        expect(err).toBeInstanceOf(StateApiError);
        expect((err as StateApiError).code).toBe('NETWORK_ERROR');
        expect((err as StateApiError).message).toContain('No internet connection');
      }
    });
  });

  describe('updateState', () => {
    const mockPayload: AutosavePayload = {
      projectId,
      planId: 'plan-456',
      schemaVersion: '1.0.0',
      timestamp: Date.now(),
      unsyncedChanges: [],
    };

    it('should update state successfully', async () => {
      const mockResponse: StateUpdateResult = {
        success: true,
        projectId,
        syncedAt: Date.now(),
        schemaVersion: '1.0.0',
      };

      vi.mocked(apiClient.put).mockResolvedValue(mockResponse);

      const result = await stateApi.updateState(projectId, mockPayload);

      expect(apiClient.put).toHaveBeenCalledWith(
        `/projects/${projectId}/state`,
        mockPayload
      );
      expect(result).toEqual(mockResponse);
    });

    it('should throw StateApiError on VERSION_MISMATCH', async () => {
      const errorMessage = 'HTTP 400: {"code":"VERSION_MISMATCH","error":"Schema version mismatch","version":"1.1.0"}';
      const error = new Error(errorMessage);
      vi.mocked(apiClient.put).mockRejectedValue(error);

      await expect(stateApi.updateState(projectId, mockPayload)).rejects.toThrow(
        StateApiError
      );

      try {
        await stateApi.updateState(projectId, mockPayload);
      } catch (err) {
        expect(err).toBeInstanceOf(StateApiError);
        expect((err as StateApiError).code).toBe('VERSION_MISMATCH');
        expect((err as StateApiError).serverVersion).toBe('1.1.0');
        expect((err as StateApiError).message).toContain('Schema version mismatch');
      }
    });

    it('should throw StateApiError when response contains conflictingChanges', async () => {
      const mockConflicts = [
        {
          id: 'change-1',
          entityType: 'stamp' as const,
          changeType: 'update' as const,
          entityId: 'stamp-123',
          timestamp: Date.now(),
          data: null,
        },
      ];

      const mockResponse: StateUpdateResult = {
        success: true,
        projectId,
        syncedAt: Date.now(),
        schemaVersion: '1.0.0',
        conflictingChanges: mockConflicts,
      };

      vi.mocked(apiClient.put).mockResolvedValue(mockResponse);

      await expect(stateApi.updateState(projectId, mockPayload)).rejects.toThrow(
        StateApiError
      );

      try {
        await stateApi.updateState(projectId, mockPayload);
      } catch (err) {
        expect(err).toBeInstanceOf(StateApiError);
        expect((err as StateApiError).code).toBe('STATE_CONFLICT');
        expect((err as StateApiError).conflictingChanges).toEqual(mockConflicts);
        expect((err as StateApiError).message).toContain('conflicts detected');
      }
    });

    it('should throw StateApiError with STATE_CONFLICT code from backend', async () => {
      const errorMessage =
        'HTTP 400: {"code":"STATE_CONFLICT","error":"Conflicting changes detected","conflictingChanges":[{"id":"c1"}]}';
      const error = new Error(errorMessage);
      vi.mocked(apiClient.put).mockRejectedValue(error);

      await expect(stateApi.updateState(projectId, mockPayload)).rejects.toThrow(
        StateApiError
      );

      try {
        await stateApi.updateState(projectId, mockPayload);
      } catch (err) {
        expect(err).toBeInstanceOf(StateApiError);
        expect((err as StateApiError).code).toBe('STATE_CONFLICT');
        expect((err as StateApiError).conflictingChanges).toBeDefined();
      }
    });

    it('should throw StateApiError on INVALID_INPUT', async () => {
      const errorMessage = 'HTTP 400: {"code":"INVALID_INPUT","error":"Missing required field"}';
      const error = new Error(errorMessage);
      vi.mocked(apiClient.put).mockRejectedValue(error);

      await expect(stateApi.updateState(projectId, mockPayload)).rejects.toThrow(
        StateApiError
      );

      try {
        await stateApi.updateState(projectId, mockPayload);
      } catch (err) {
        expect(err).toBeInstanceOf(StateApiError);
        expect((err as StateApiError).code).toBe('INVALID_INPUT');
        expect((err as StateApiError).httpStatus).toBe(400);
      }
    });

    it('should handle network errors with offline detection', async () => {
      vi.stubGlobal('navigator', { onLine: false });
      const error = new Error('Network request failed');
      vi.mocked(apiClient.put).mockRejectedValue(error);

      await expect(stateApi.updateState(projectId, mockPayload)).rejects.toThrow(
        StateApiError
      );

      try {
        await stateApi.updateState(projectId, mockPayload);
      } catch (err) {
        expect(err).toBeInstanceOf(StateApiError);
        expect((err as StateApiError).code).toBe('NETWORK_ERROR');
        expect((err as StateApiError).message).toContain('No internet connection');
      }
    });

    it('should handle generic HTTP 500 errors', async () => {
      const error = new Error('HTTP 500');
      vi.mocked(apiClient.put).mockRejectedValue(error);

      await expect(stateApi.updateState(projectId, mockPayload)).rejects.toThrow(
        StateApiError
      );

      try {
        await stateApi.updateState(projectId, mockPayload);
      } catch (err) {
        expect(err).toBeInstanceOf(StateApiError);
        expect((err as StateApiError).code).toBe('UNKNOWN');
        expect((err as StateApiError).httpStatus).toBe(500);
      }
    });

    it('should handle unknown errors without HTTP status', async () => {
      const error = new Error('Unknown error');
      vi.mocked(apiClient.put).mockRejectedValue(error);

      await expect(stateApi.updateState(projectId, mockPayload)).rejects.toThrow(
        StateApiError
      );

      try {
        await stateApi.updateState(projectId, mockPayload);
      } catch (err) {
        expect(err).toBeInstanceOf(StateApiError);
        expect((err as StateApiError).code).toBe('UNKNOWN');
        expect((err as StateApiError).message).toBe('Unknown error');
      }
    });
  });

  describe('error parsing edge cases', () => {
    it('should handle errors with no message', async () => {
      vi.mocked(apiClient.get).mockRejectedValue({});

      await expect(stateApi.getStateVersion(projectId)).rejects.toThrow(StateApiError);
    });

    it('should handle non-Error thrown values', async () => {
      vi.mocked(apiClient.get).mockRejectedValue('string error');

      await expect(stateApi.getStateVersion(projectId)).rejects.toThrow(StateApiError);
    });

    it('should extract JSON from complex error messages', async () => {
      const errorMessage = 'Request failed: HTTP 400 - {"code":"VERSION_MISMATCH","version":"2.0.0"}';
      const error = new Error(errorMessage);
      vi.mocked(apiClient.put).mockRejectedValue(error);

      try {
        await stateApi.updateState(projectId, {
          projectId,
          planId: null,
          schemaVersion: '1.0.0',
          timestamp: Date.now(),
          unsyncedChanges: [],
        });
      } catch (err) {
        expect(err).toBeInstanceOf(StateApiError);
        expect((err as StateApiError).code).toBe('VERSION_MISMATCH');
        expect((err as StateApiError).serverVersion).toBe('2.0.0');
      }
    });
  });
});
