/**
 * Session Persist Hook
 * React hook for periodically saving session state to IndexedDB cache
 */

import { useCallback, useEffect, useRef } from 'react';
import { cacheService } from '../services/cacheService';
import type { ProjectSessionState } from '../types';

/**
 * useSessionPersist Hook Options
 */
export interface UseSessionPersistOptions {
  projectId: string;
  planId: string | null;
  getSessionState: () => ProjectSessionState;
  intervalMs?: number;
  enabled?: boolean;
}

/**
 * useSessionPersist Hook
 *
 * Periodically saves session state to IndexedDB for offline fallback.
 * Works in conjunction with autosave to provide local cache resilience.
 *
 * @example
 * ```tsx
 * function ProjectEditor({ projectId }) {
 *   useSessionPersist({
 *     projectId,
 *     planId: currentPlanId,
 *     getSessionState: () => ({
 *       projectId,
 *       planId: currentPlanId,
 *       schemaVersion: '1.0.0',
 *       lastSyncedAt: Date.now(),
 *       unsyncedChanges: sessionStore.unsyncedChanges,
 *       stamps: stampStore.stamps,
 *       locations: locationStore.locations,
 *     }),
 *     intervalMs: 10000, // Save every 10 seconds
 *   });
 *
 *   return <div>...</div>;
 * }
 * ```
 */
export function useSessionPersist(options: UseSessionPersistOptions) {
  const {
    projectId,
    planId,
    getSessionState,
    intervalMs = 10000, // 10 seconds default
    enabled = true,
  } = options;

  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);
  const lastSaveTimeRef = useRef<number>(0);

  /**
   * Persist session state to cache
   */
  const persistSession = useCallback(async () => {
    if (!enabled) return;

    try {
      const sessionState = getSessionState();

      await cacheService.saveSession(projectId, planId, sessionState);

      lastSaveTimeRef.current = Date.now();
    } catch (error) {
      console.error('Failed to persist session to cache:', error);
    }
  }, [enabled, projectId, planId, getSessionState]);

  /**
   * Set up periodic persist interval
   */
  useEffect(() => {
    if (!enabled) return;

    // Initial save
    void persistSession();

    // Set up interval
    intervalIdRef.current = setInterval(() => {
      void persistSession();
    }, intervalMs);

    return () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
    };
  }, [enabled, intervalMs, projectId, planId, persistSession]);

  /**
   * Persist on visibility change (when user returns to tab)
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && enabled) {
        void persistSession();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, persistSession]);

  /**
   * Persist before unload
   */
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (enabled) {
        // Synchronous save (best effort)
        const sessionState = getSessionState();
        try {
          void cacheService.saveSession(projectId, planId, sessionState);
        } catch (error) {
          console.error('Failed to persist session before unload:', error);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [enabled, projectId, planId, getSessionState]);

  return {
    persist: persistSession,
    lastSaveTime: lastSaveTimeRef.current,
  };
}
