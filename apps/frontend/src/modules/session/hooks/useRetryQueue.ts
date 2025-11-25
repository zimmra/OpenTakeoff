/**
 * Retry Queue Hook
 * React hook for managing retry queue with exponential backoff
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSessionStore } from '../state/useSessionStore';
import { autosaveService } from '../services/autosaveService';
import type { RetryConfig } from '../types';
import { DEFAULT_RETRY_CONFIG } from '../types';

/**
 * useRetryQueue Hook Options
 */
export interface UseRetryQueueOptions {
  projectId: string;
  planId: string | null;
  config?: Partial<RetryConfig>;
  enabled?: boolean;
}

/**
 * Retry attempt tracking
 */
interface RetryAttempt {
  attemptNumber: number;
  nextRetryAt: number;
}

/**
 * useRetryQueue Hook
 *
 * Implements exponential backoff retry logic for failed autosave attempts.
 * Automatically retries when online status is restored.
 *
 * @example
 * ```tsx
 * function ProjectEditor({ projectId }) {
 *   const { isRetrying, retryCount } = useRetryQueue({
 *     projectId,
 *     planId: currentPlanId,
 *     config: { maxAttempts: 5 },
 *   });
 *
 *   return <div>Retries: {retryCount}</div>;
 * }
 * ```
 */
export function useRetryQueue(options: UseRetryQueueOptions) {
  const { projectId, planId, config = {}, enabled = true } = options;

  const mergedConfig: RetryConfig = {
    ...DEFAULT_RETRY_CONFIG,
    ...config,
  };

  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const retryAttemptRef = useRef<RetryAttempt>({ attemptNumber: 0, nextRetryAt: 0 });
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { syncStatus, isOnline, unsyncedChanges, lastSyncError } = useSessionStore();

  /**
   * Calculate next retry delay with exponential backoff
   */
  const calculateDelay = useCallback((attemptNumber: number): number => {
    const delay = Math.min(
      mergedConfig.initialDelayMs * Math.pow(mergedConfig.backoffMultiplier, attemptNumber),
      mergedConfig.maxDelayMs,
    );
    return delay;
  }, [mergedConfig.initialDelayMs, mergedConfig.backoffMultiplier, mergedConfig.maxDelayMs]);

  /**
   * Attempt to retry autosave
   */
  const attemptRetry = useCallback(async () => {
    if (!enabled || !isOnline || unsyncedChanges.length === 0) {
      return;
    }

    // Pause retries when in conflict state - user must resolve manually
    if (syncStatus === 'conflict') {
      console.log('[Retry Queue] Pausing retries due to conflict state');
      setIsRetrying(false);
      return;
    }

    // Check if we've exceeded max attempts
    if (retryAttemptRef.current.attemptNumber >= mergedConfig.maxAttempts) {
      console.error('Max retry attempts exceeded');
      setIsRetrying(false);
      return;
    }

    setIsRetrying(true);
    retryAttemptRef.current.attemptNumber += 1;
    setRetryCount(retryAttemptRef.current.attemptNumber);

    try {
      await autosaveService.flush({
        projectId,
        planId,
        unsyncedChanges,
      });

      // Success - reset retry state
      retryAttemptRef.current = { attemptNumber: 0, nextRetryAt: 0 };
      setRetryCount(0);
      setIsRetrying(false);

      console.log('Retry succeeded');
    } catch {
      // Failed - schedule next retry
      const delay = calculateDelay(retryAttemptRef.current.attemptNumber);
      retryAttemptRef.current.nextRetryAt = Date.now() + delay;

      console.log(
        `Retry ${retryAttemptRef.current.attemptNumber} failed, next retry in ${delay}ms`,
      );

      retryTimeoutRef.current = setTimeout(() => {
        void attemptRetry();
      }, delay);
    }
  }, [enabled, isOnline, unsyncedChanges, projectId, planId, mergedConfig.maxAttempts, calculateDelay, syncStatus]);

  /**
   * Trigger retry when back online
   */
  useEffect(() => {
    if (
      enabled &&
      isOnline &&
      syncStatus === 'error' &&
      lastSyncError?.retryable &&
      unsyncedChanges.length > 0
    ) {
      // Reset attempt counter when transitioning from offline to online
      if (retryAttemptRef.current.attemptNumber === 0) {
        void attemptRetry();
      }
    }
  }, [enabled, isOnline, syncStatus, lastSyncError, unsyncedChanges.length, attemptRetry]);

  /**
   * Cleanup retry timeout on unmount
   */
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, []);

  /**
   * Manual retry trigger
   */
  const retryNow = () => {
    // Clear any pending timeout
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    // Reset and retry immediately
    retryAttemptRef.current = { attemptNumber: 0, nextRetryAt: 0 };
    setRetryCount(0);
    void attemptRetry();
  };

  return {
    isRetrying,
    retryCount,
    retryNow,
    canRetry: retryAttemptRef.current.attemptNumber < mergedConfig.maxAttempts,
    nextRetryAt: retryAttemptRef.current.nextRetryAt,
  };
}
