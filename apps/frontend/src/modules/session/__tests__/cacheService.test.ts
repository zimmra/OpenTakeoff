/**
 * Cache Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { cacheService } from '../services/cacheService';
import type { ProjectSessionState, CachedSessionState } from '../types';
import * as idbKeyval from 'idb-keyval';

vi.mock('idb-keyval');

describe('cacheService', () => {
  const mockSessionState: ProjectSessionState = {
    projectId: 'project-1',
    planId: 'plan-1',
    schemaVersion: '1.0.0',
    lastSyncedAt: Date.now(),
    unsyncedChanges: [],
    stamps: [],
    locations: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('saveSession', () => {
    it('should save session to IndexedDB', async () => {
      const setSpy = vi.spyOn(idbKeyval, 'set').mockResolvedValue(undefined);

      await cacheService.saveSession('project-1', 'plan-1', mockSessionState);

      expect(setSpy).toHaveBeenCalledWith(
        'session:project-1:plan-1',
        expect.objectContaining({
          projectId: 'project-1',
          planId: 'plan-1',
          schemaVersion: '1.0.0',
          cachedAt: expect.any(Number) as number,
          sessionState: mockSessionState,
        }),
      );
    });

    it('should handle null planId', async () => {
      const setSpy = vi.spyOn(idbKeyval, 'set').mockResolvedValue(undefined);

      await cacheService.saveSession('project-1', null, mockSessionState);

      expect(setSpy).toHaveBeenCalledWith(
        'session:project-1',
        expect.objectContaining({
          projectId: 'project-1',
          planId: null,
        }),
      );
    });
  });

  describe('loadSession', () => {
    it('should load session from IndexedDB', async () => {
      const cached: CachedSessionState = {
        projectId: 'project-1',
        planId: 'plan-1',
        schemaVersion: '1.0.0',
        cachedAt: Date.now(),
        sessionState: mockSessionState,
      };

      vi.spyOn(idbKeyval, 'get').mockResolvedValue(cached);

      const result = await cacheService.loadSession('project-1', 'plan-1');

      expect(result).toEqual(cached);
    });

    it('should return null if no cache exists', async () => {
      vi.spyOn(idbKeyval, 'get').mockResolvedValue(undefined);

      const result = await cacheService.loadSession('project-1', 'plan-1');

      expect(result).toBeNull();
    });
  });

  describe('deleteSession', () => {
    it('should delete session from IndexedDB', async () => {
      const delSpy = vi.spyOn(idbKeyval, 'del').mockResolvedValue(undefined);

      await cacheService.deleteSession('project-1', 'plan-1');

      expect(delSpy).toHaveBeenCalledWith('session:project-1:plan-1');
    });
  });

  describe('clearAllSessions', () => {
    it('should clear all sessions from IndexedDB', async () => {
      const clearSpy = vi.spyOn(idbKeyval, 'clear').mockResolvedValue(undefined);

      await cacheService.clearAllSessions();

      expect(clearSpy).toHaveBeenCalled();
    });
  });

  describe('hasSession', () => {
    it('should return true if session exists', async () => {
      const cached: CachedSessionState = {
        projectId: 'project-1',
        planId: 'plan-1',
        schemaVersion: '1.0.0',
        cachedAt: Date.now(),
        sessionState: mockSessionState,
      };

      vi.spyOn(idbKeyval, 'get').mockResolvedValue(cached);

      const result = await cacheService.hasSession('project-1', 'plan-1');

      expect(result).toBe(true);
    });

    it('should return false if session does not exist', async () => {
      vi.spyOn(idbKeyval, 'get').mockResolvedValue(undefined);

      const result = await cacheService.hasSession('project-1', 'plan-1');

      expect(result).toBe(false);
    });
  });

  describe('isCacheStale', () => {
    it('should return false for fresh cache', () => {
      const cached: CachedSessionState = {
        projectId: 'project-1',
        planId: 'plan-1',
        schemaVersion: '1.0.0',
        cachedAt: Date.now() - 1000, // 1 second ago
        sessionState: mockSessionState,
      };

      const result = cacheService.isCacheStale(cached, 86400000); // 24 hours

      expect(result).toBe(false);
    });

    it('should return true for stale cache', () => {
      const cached: CachedSessionState = {
        projectId: 'project-1',
        planId: 'plan-1',
        schemaVersion: '1.0.0',
        cachedAt: Date.now() - 90000000, // 25 hours ago
        sessionState: mockSessionState,
      };

      const result = cacheService.isCacheStale(cached, 86400000); // 24 hours

      expect(result).toBe(true);
    });
  });

  describe('getCacheAge', () => {
    it('should return cache age in milliseconds', () => {
      const cached: CachedSessionState = {
        projectId: 'project-1',
        planId: 'plan-1',
        schemaVersion: '1.0.0',
        cachedAt: Date.now() - 5000, // 5 seconds ago
        sessionState: mockSessionState,
      };

      const age = cacheService.getCacheAge(cached);

      expect(age).toBeGreaterThanOrEqual(5000);
      expect(age).toBeLessThan(6000);
    });
  });
});
