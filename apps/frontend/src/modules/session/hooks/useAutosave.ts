/**
 * Autosave Hook
 * React hook that implements 5-second autosave interval with flush service
 */

import { useEffect, useRef, useCallback } from 'react';
import { useSessionStore } from '../state/useSessionStore';
import { autosaveService } from '../services/autosaveService';
import type { AutosaveConfig } from '../types';
import { DEFAULT_AUTOSAVE_CONFIG } from '../types';

/**
 * useAutosave Hook Options
 */
export interface UseAutosaveOptions {
  projectId: string;
  planId: string | null;
  config?: Partial<AutosaveConfig>;
  enabled?: boolean;
}

/**
 * useAutosave Hook
 *
 * Implements periodic autosave with configurable interval and retry logic.
 * Automatically flushes pending changes to the backend every N seconds.
 *
 * @example
 * ```tsx
 * function ProjectEditor({ projectId }) {
 *   useAutosave({
 *     projectId,
 *     planId: currentPlanId,
 *     config: { intervalMs: 5000 },
 *     enabled: true
 *   });
 *
 *   return <div>...</div>;
 * }
 * ```
 */
export function useAutosave(options: UseAutosaveOptions) {
  const { projectId, planId, config = {}, enabled = true } = options;

  const mergedConfig: AutosaveConfig = {
    ...DEFAULT_AUTOSAVE_CONFIG,
    ...config,
  };

  const unsyncedChanges = useSessionStore((state) => state.unsyncedChanges);
  const syncStatus = useSessionStore((state) => state.syncStatus);
  const isOnline = useSessionStore((state) => state.isOnline);

  // Track if flush is currently in progress to prevent overlapping calls
  const flushInProgressRef = useRef(false);
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Flush pending changes to backend
   */
  const flushPendingChanges = useCallback(async () => {
    // Skip if disabled, already flushing, offline, or no changes
    if (!enabled || flushInProgressRef.current || !isOnline || unsyncedChanges.length === 0) {
      return;
    }

    // Skip if already in error state (will be retried separately)
    if (syncStatus === 'error') {
      return;
    }

    flushInProgressRef.current = true;

    try {
      await autosaveService.flush({
        projectId,
        planId,
        unsyncedChanges,
      });
    } catch (error) {
      // Error is already handled by autosaveService
      console.error('Autosave flush failed:', error);
    } finally {
      flushInProgressRef.current = false;
    }
  }, [enabled, isOnline, unsyncedChanges, syncStatus, projectId, planId]);

  /**
   * Set up autosave interval
   */
  useEffect(() => {
    if (!enabled || !mergedConfig.enabled) {
      return;
    }

    // Set up interval
    intervalIdRef.current = setInterval(() => {
      void flushPendingChanges();
    }, mergedConfig.intervalMs);

    // Cleanup on unmount or config change
    return () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
    };
  }, [enabled, mergedConfig.enabled, mergedConfig.intervalMs, flushPendingChanges]);

  /**
   * Flush on visibility change (when user returns to tab)
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && enabled && isOnline && unsyncedChanges.length > 0) {
        void flushPendingChanges();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, isOnline, unsyncedChanges.length, flushPendingChanges]);

  /**
   * Flush before unload (best effort)
   */
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (enabled && unsyncedChanges.length > 0) {
        // Use sendBeacon for best-effort delivery
        const payload = autosaveService.buildPayload({
          projectId,
          planId,
          unsyncedChanges,
        });

        navigator.sendBeacon(
          `/projects/${projectId}/state`,
          JSON.stringify(payload),
        );
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [enabled, unsyncedChanges, projectId, planId]);

  return {
    flush: flushPendingChanges,
    isFlushInProgress: flushInProgressRef.current,
  };
}
