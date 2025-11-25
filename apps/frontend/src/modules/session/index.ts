/**
 * Session Module
 * Exports for session persistence, autosave, and offline caching
 */

export * from './types';
export * from './state/useSessionStore';
export * from './hooks/useAutosave';
export * from './hooks/useSessionRestore';
export * from './hooks/useSessionPersist';
export * from './hooks/useVersionDrift';
export * from './hooks/useOnlineStatus';
export * from './hooks/useRetryQueue';
export * from './services/autosaveService';
export * from './services/cacheService';
export * from './components/VersionMismatchModal';
export * from './components/SyncStatusToast';

/**
 * Session State API Client
 * Typed client for project state operations with conflict handling
 *
 * @example
 * ```typescript
 * import { stateApi } from '@/modules/session';
 *
 * // Check version
 * const versionInfo = await stateApi.getStateVersion('project-123');
 *
 * // Update state
 * const result = await stateApi.updateState('project-123', payload);
 * ```
 */
export { stateApi } from './api/stateApi';
