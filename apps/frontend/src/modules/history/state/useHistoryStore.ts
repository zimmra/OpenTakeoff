/**
 * History State Store
 * Zustand store for managing undo/redo history state
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { HistoryEntry } from '../types';

/**
 * History state interface
 */
interface HistoryState {
  // History entries (most recent first)
  entries: HistoryEntry[];

  // Whether undo is in progress
  isUndoing: boolean;

  // Whether history is being loaded
  isLoading: boolean;

  // Error message if any
  error: string | null;

  // Actions
  setEntries: (entries: HistoryEntry[]) => void;
  addEntry: (entry: HistoryEntry) => void;
  removeLatestEntry: () => void;
  setIsUndoing: (isUndoing: boolean) => void;
  setIsLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  clearHistory: () => void;
}

/**
 * History state store with Immer middleware for immutable updates
 */
export const useHistoryStore = create<HistoryState>()(
  immer((set) => ({
    // Initial state
    entries: [],
    isUndoing: false,
    isLoading: false,
    error: null,

    // Set all entries (replaces existing)
    setEntries: (entries) =>
      set((state) => {
        state.entries = entries;
      }),

    // Add a single entry to the beginning (most recent)
    addEntry: (entry) =>
      set((state) => {
        state.entries.unshift(entry);
        // Limit to 100 entries
        if (state.entries.length > 100) {
          state.entries = state.entries.slice(0, 100);
        }
      }),

    // Remove the most recent entry (after undo)
    removeLatestEntry: () =>
      set((state) => {
        state.entries.shift();
      }),

    // Set undoing state
    setIsUndoing: (isUndoing) =>
      set((state) => {
        state.isUndoing = isUndoing;
      }),

    // Set loading state
    setIsLoading: (isLoading) =>
      set((state) => {
        state.isLoading = isLoading;
      }),

    // Set error message
    setError: (error) =>
      set((state) => {
        state.error = error;
      }),

    // Clear all history
    clearHistory: () =>
      set((state) => {
        state.entries = [];
        state.error = null;
      }),
  }))
);

/**
 * Selector hooks for common use cases
 */

/**
 * Get whether there are any history entries to undo
 */
export const useCanUndo = () => useHistoryStore((state) => state.entries.length > 0);

/**
 * Get the latest history entry (that would be undone next)
 */
export const useLatestEntry = () =>
  useHistoryStore((state) => (state.entries.length > 0 ? state.entries[0] : null));

/**
 * Get history count
 */
export const useHistoryCount = () => useHistoryStore((state) => state.entries.length);
