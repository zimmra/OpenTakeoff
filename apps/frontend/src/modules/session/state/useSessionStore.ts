/**
 * Session State Store
 * Zustand store for managing session sync status and state
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  SessionManagerState,
  SyncStatus,
  SyncError,
  UnsyncedChange,
} from '../types';

interface SessionState extends SessionManagerState {
  // Actions
  setSyncStatus: (status: SyncStatus) => void;
  setLastSyncedAt: (timestamp: number) => void;
  setLastSyncError: (error: SyncError | null) => void;
  setPendingChanges: (count: number) => void;
  setIsOnline: (isOnline: boolean) => void;
  setSchemaVersion: (version: string) => void;
  setServerSchemaVersion: (version: string | null) => void;

  // Unsynced changes buffer
  unsyncedChanges: UnsyncedChange[];
  addUnsyncedChange: (change: UnsyncedChange) => void;
  clearUnsyncedChanges: () => void;
  removeUnsyncedChange: (id: string) => void;

  // Conflict tracking
  conflictingChanges: UnsyncedChange[];
  setConflictingChanges: (changes: UnsyncedChange[]) => void;
  clearConflictingChanges: () => void;
}

/**
 * Session state store with Immer middleware
 */
export const useSessionStore = create<SessionState>()(
  immer((set) => ({
    // Initial state
    syncStatus: 'synced',
    lastSyncedAt: null,
    lastSyncError: null,
    pendingChanges: 0,
    isOnline: true,
    schemaVersion: '1.0.0',
    serverSchemaVersion: null,
    hasVersionMismatch: false,
    unsyncedChanges: [],
    conflictingChanges: [],

    // Actions
    setSyncStatus: (status) =>
      set((state) => {
        state.syncStatus = status;
      }),

    setLastSyncedAt: (timestamp) =>
      set((state) => {
        state.lastSyncedAt = timestamp;
      }),

    setLastSyncError: (error) =>
      set((state) => {
        state.lastSyncError = error;
      }),

    setPendingChanges: (count) =>
      set((state) => {
        state.pendingChanges = count;
      }),

    setIsOnline: (isOnline) =>
      set((state) => {
        state.isOnline = isOnline;
      }),

    setSchemaVersion: (version) =>
      set((state) => {
        state.schemaVersion = version;
      }),

    setServerSchemaVersion: (version) =>
      set((state) => {
        state.serverSchemaVersion = version;
        state.hasVersionMismatch =
          version !== null && version !== state.schemaVersion;
      }),

    // Unsynced changes management
    addUnsyncedChange: (change) =>
      set((state) => {
        state.unsyncedChanges.push(change);
        state.pendingChanges = state.unsyncedChanges.length;
      }),

    clearUnsyncedChanges: () =>
      set((state) => {
        state.unsyncedChanges = [];
        state.pendingChanges = 0;
      }),

    removeUnsyncedChange: (id) =>
      set((state) => {
        state.unsyncedChanges = state.unsyncedChanges.filter((c) => c.id !== id);
        state.pendingChanges = state.unsyncedChanges.length;
      }),

    // Conflict tracking management
    setConflictingChanges: (changes) =>
      set((state) => {
        state.conflictingChanges = changes;
      }),

    clearConflictingChanges: () =>
      set((state) => {
        state.conflictingChanges = [];
      }),
  })),
);
