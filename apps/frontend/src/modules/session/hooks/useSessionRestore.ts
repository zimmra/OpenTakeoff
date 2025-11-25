/**
 * Session Restore Hook
 * React hook for restoring session state from cache on startup
 */

import { useEffect, useState } from 'react';
import { cacheService } from '../services/cacheService';
import { useSessionStore } from '../state/useSessionStore';
import type { ProjectSessionState } from '../types';

/**
 * useSessionRestore Hook Options
 */
export interface UseSessionRestoreOptions {
  projectId: string;
  planId: string | null;
  onRestore?: (sessionState: ProjectSessionState) => void;
  onRestoreError?: (error: Error) => void;
  maxCacheAgeMs?: number;
}

/**
 * Session restore status
 */
export type RestoreStatus = 'idle' | 'restoring' | 'restored' | 'error' | 'no-cache';

/**
 * useSessionRestore Hook
 *
 * Loads cached session state from IndexedDB on mount and restores it.
 * Useful for recovering from page refreshes or offline scenarios.
 *
 * @example
 * ```tsx
 * function ProjectEditor({ projectId }) {
 *   const { status, restoredState } = useSessionRestore({
 *     projectId,
 *     planId: currentPlanId,
 *     onRestore: (state) => {
 *       // Hydrate stamps and locations stores
 *       stampStore.setStamps(state.stamps);
 *       locationStore.setLocations(state.locations);
 *     },
 *   });
 *
 *   if (status === 'restoring') return <Loading />;
 *
 *   return <div>...</div>;
 * }
 * ```
 */
export function useSessionRestore(options: UseSessionRestoreOptions) {
  const {
    projectId,
    planId,
    onRestore,
    onRestoreError,
    maxCacheAgeMs = 86400000, // 24 hours
  } = options;

  const [status, setStatus] = useState<RestoreStatus>('idle');
  const [restoredState, setRestoredState] = useState<ProjectSessionState | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const { setSchemaVersion, setLastSyncedAt } = useSessionStore();

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      if (!projectId) return;

      setStatus('restoring');
      setError(null);

      try {
        // Load cached session
        const cached = await cacheService.loadSession(projectId, planId);

        if (cancelled) return;

        // No cache found
        if (!cached) {
          setStatus('no-cache');
          return;
        }

        // Check if cache is stale
        if (cacheService.isCacheStale(cached, maxCacheAgeMs)) {
          console.warn(
            `Cached session is stale (${cacheService.getCacheAge(cached)}ms old). Skipping restore.`,
          );
          setStatus('no-cache');
          await cacheService.deleteSession(projectId, planId);
          return;
        }

        // Restore session state
        const sessionState = cached.sessionState;

        setRestoredState(sessionState);
        setSchemaVersion(sessionState.schemaVersion);
        setLastSyncedAt(sessionState.lastSyncedAt);

        // Call onRestore callback
        if (onRestore) {
          onRestore(sessionState);
        }

        setStatus('restored');

        console.log(
          `Restored session from cache (${cacheService.getCacheAge(cached)}ms old)`,
          {
            projectId,
            planId,
            unsyncedChanges: sessionState.unsyncedChanges.length,
          },
        );
      } catch (err) {
        if (cancelled) return;

        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        setStatus('error');

        if (onRestoreError) {
          onRestoreError(error);
        }

        console.error('Failed to restore session from cache:', error);
      }
    }

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, [
    projectId,
    planId,
    maxCacheAgeMs,
    onRestore,
    onRestoreError,
    setSchemaVersion,
    setLastSyncedAt,
  ]);

  return {
    status,
    restoredState,
    error,
    isRestoring: status === 'restoring',
    isRestored: status === 'restored',
    hasCache: status === 'restored',
  };
}
