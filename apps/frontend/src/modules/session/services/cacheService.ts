/**
 * Cache Service
 * Handles IndexedDB caching for offline fallback using idb-keyval
 */

import { get, set, del, clear } from 'idb-keyval';
import type { CachedSessionState, ProjectSessionState } from '../types';

/**
 * Generate cache key for a project session
 */
function getCacheKey(projectId: string, planId: string | null): string {
  return planId ? `session:${projectId}:${planId}` : `session:${projectId}`;
}

/**
 * Save session state to IndexedDB
 */
async function saveSession(
  projectId: string,
  planId: string | null,
  sessionState: ProjectSessionState,
): Promise<void> {
  const key = getCacheKey(projectId, planId);

  const cached: CachedSessionState = {
    projectId,
    planId,
    schemaVersion: sessionState.schemaVersion,
    cachedAt: Date.now(),
    sessionState,
  };

  await set(key, cached);
}

/**
 * Load session state from IndexedDB
 */
async function loadSession(
  projectId: string,
  planId: string | null,
): Promise<CachedSessionState | null> {
  const key = getCacheKey(projectId, planId);

  const cached = await get<CachedSessionState>(key);

  return cached ?? null;
}

/**
 * Delete session state from IndexedDB
 */
async function deleteSession(projectId: string, planId: string | null): Promise<void> {
  const key = getCacheKey(projectId, planId);
  await del(key);
}

/**
 * Clear all cached sessions
 */
async function clearAllSessions(): Promise<void> {
  await clear();
}

/**
 * Check if session cache exists
 */
async function hasSession(projectId: string, planId: string | null): Promise<boolean> {
  const cached = await loadSession(projectId, planId);
  return cached !== null;
}

/**
 * Get cache age in milliseconds
 */
function getCacheAge(cached: CachedSessionState): number {
  return Date.now() - cached.cachedAt;
}

/**
 * Check if cache is stale (older than maxAge)
 */
function isCacheStale(cached: CachedSessionState, maxAgeMs = 86400000): boolean {
  return getCacheAge(cached) > maxAgeMs; // Default: 24 hours
}

/**
 * Cache Service
 */
export const cacheService = {
  saveSession,
  loadSession,
  deleteSession,
  clearAllSessions,
  hasSession,
  getCacheAge,
  isCacheStale,
};
