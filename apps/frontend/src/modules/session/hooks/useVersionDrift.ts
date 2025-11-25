/**
 * Version Drift Detection Hook
 * React hook for detecting schema version mismatches between client and server
 */

import { useCallback, useEffect, useState } from 'react';
import { stateApi } from '../api/stateApi';
import { StateApiError } from '../types';
import { useSessionStore } from '../state/useSessionStore';

const CURRENT_SCHEMA_VERSION = '1.0.0';
const VERSION_CHECK_INTERVAL_MS = 60000; // 1 minute

/**
 * useVersionDrift Hook Options
 */
export interface UseVersionDriftOptions {
  projectId: string;
  enabled?: boolean;
  checkIntervalMs?: number;
  onVersionMismatch?: (clientVersion: string, serverVersion: string) => void;
}

/**
 * useVersionDrift Hook
 *
 * Periodically checks server schema version and detects drift.
 * Sets hasVersionMismatch flag in session store when mismatch is detected.
 *
 * @example
 * ```tsx
 * function App() {
 *   const { hasMismatch, serverVersion } = useVersionDrift({
 *     projectId: 'project-1',
 *     onVersionMismatch: (client, server) => {
 *       console.warn(`Version mismatch: client=${client}, server=${server}`);
 *     },
 *   });
 *
 *   if (hasMismatch) {
 *     return <VersionMismatchModal serverVersion={serverVersion} />;
 *   }
 *
 *   return <App />;
 * }
 * ```
 */
export function useVersionDrift(options: UseVersionDriftOptions) {
  const {
    projectId,
    enabled = true,
    checkIntervalMs = VERSION_CHECK_INTERVAL_MS,
    onVersionMismatch,
  } = options;

  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<number | null>(null);

  const { serverSchemaVersion, hasVersionMismatch, setServerSchemaVersion } =
    useSessionStore();

  /**
   * Check server version
   * Uses the shared stateApi client for version checking
   */
  const checkVersion = useCallback(async () => {
    if (!enabled || isChecking) return;

    setIsChecking(true);

    try {
      const response = await stateApi.getStateVersion(projectId);

      const serverVersion = response.version;

      // Update server version in store (also sets hasVersionMismatch)
      setServerSchemaVersion(serverVersion);

      setLastChecked(Date.now());

      // Detect mismatch
      if (serverVersion !== CURRENT_SCHEMA_VERSION) {
        if (onVersionMismatch) {
          onVersionMismatch(CURRENT_SCHEMA_VERSION, serverVersion);
        }
      }
    } catch (error) {
      // Centralized error logging with structured error information
      if (error instanceof StateApiError) {
        console.error(
          `[Version Drift] Failed to check server version (${error.code}):`,
          error.message,
          {
            httpStatus: error.httpStatus,
            projectId,
          }
        );
      } else {
        console.error('[Version Drift] Failed to check server version:', error);
      }
    } finally {
      setIsChecking(false);
    }
  }, [enabled, isChecking, projectId, setServerSchemaVersion, onVersionMismatch]);

  /**
   * Set up periodic version check
   */
  useEffect(() => {
    if (!enabled) return;

    // Initial check
    void checkVersion();

    // Set up interval
    const intervalId = setInterval(() => {
      void checkVersion();
    }, checkIntervalMs);

    return () => {
      clearInterval(intervalId);
    };
  }, [enabled, checkIntervalMs, projectId, checkVersion]);

  return {
    hasMismatch: hasVersionMismatch,
    clientVersion: CURRENT_SCHEMA_VERSION,
    serverVersion: serverSchemaVersion,
    isChecking,
    lastChecked,
    checkNow: checkVersion,
  };
}
