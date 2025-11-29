/**
 * History Store Tests
 * Tests for the history state store (undo/redo functionality)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHistoryStore, useCanUndo, useLatestEntry, useHistoryCount } from '../useHistoryStore';
import type { HistoryEntry } from '../../types';

// Helper to create mock history entries
const createMockEntry = (overrides?: Partial<HistoryEntry>): HistoryEntry => ({
  id: `entry-${Math.random().toString(36).slice(2)}`,
  entityId: 'stamp-123',
  entityType: 'stamp',
  type: 'create',
  snapshot: null,
  createdAt: new Date().toISOString(),
  ...overrides,
});

describe('useHistoryStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    const store = useHistoryStore.getState();
    store.clearHistory();
    store.setIsUndoing(false);
    store.setIsLoading(false);
    store.setError(null);
  });

  describe('initial state', () => {
    it('should have empty entries array', () => {
      const { result } = renderHook(() => useHistoryStore());
      expect(result.current.entries).toEqual([]);
    });

    it('should have isUndoing as false', () => {
      const { result } = renderHook(() => useHistoryStore());
      expect(result.current.isUndoing).toBe(false);
    });

    it('should have isLoading as false', () => {
      const { result } = renderHook(() => useHistoryStore());
      expect(result.current.isLoading).toBe(false);
    });

    it('should have error as null', () => {
      const { result } = renderHook(() => useHistoryStore());
      expect(result.current.error).toBeNull();
    });
  });

  describe('setEntries', () => {
    it('should set entries array', () => {
      const { result } = renderHook(() => useHistoryStore());
      const mockEntries = [createMockEntry(), createMockEntry()];

      act(() => {
        result.current.setEntries(mockEntries);
      });

      expect(result.current.entries).toEqual(mockEntries);
    });

    it('should replace existing entries', () => {
      const { result } = renderHook(() => useHistoryStore());
      const initialEntries = [createMockEntry()];
      const newEntries = [createMockEntry(), createMockEntry(), createMockEntry()];

      act(() => {
        result.current.setEntries(initialEntries);
      });
      expect(result.current.entries).toHaveLength(1);

      act(() => {
        result.current.setEntries(newEntries);
      });
      expect(result.current.entries).toHaveLength(3);
    });
  });

  describe('addEntry', () => {
    it('should add entry to the beginning of the array', () => {
      const { result } = renderHook(() => useHistoryStore());
      const entry1 = createMockEntry({ id: 'entry-1' });
      const entry2 = createMockEntry({ id: 'entry-2' });

      act(() => {
        result.current.addEntry(entry1);
      });
      act(() => {
        result.current.addEntry(entry2);
      });

      expect(result.current.entries[0]?.id).toBe('entry-2');
      expect(result.current.entries[1]?.id).toBe('entry-1');
    });

    it('should limit entries to 100', () => {
      const { result } = renderHook(() => useHistoryStore());

      act(() => {
        for (let i = 0; i < 105; i++) {
          result.current.addEntry(createMockEntry({ id: `entry-${i}` }));
        }
      });

      expect(result.current.entries).toHaveLength(100);
      // Most recent entry should be at index 0
      expect(result.current.entries[0]?.id).toBe('entry-104');
    });
  });

  describe('removeLatestEntry', () => {
    it('should remove the first entry', () => {
      const { result } = renderHook(() => useHistoryStore());
      const entry1 = createMockEntry({ id: 'entry-1' });
      const entry2 = createMockEntry({ id: 'entry-2' });

      act(() => {
        result.current.setEntries([entry2, entry1]);
      });
      expect(result.current.entries).toHaveLength(2);

      act(() => {
        result.current.removeLatestEntry();
      });

      expect(result.current.entries).toHaveLength(1);
      expect(result.current.entries[0]?.id).toBe('entry-1');
    });

    it('should handle empty array gracefully', () => {
      const { result } = renderHook(() => useHistoryStore());

      act(() => {
        result.current.removeLatestEntry();
      });

      expect(result.current.entries).toHaveLength(0);
    });
  });

  describe('setIsUndoing', () => {
    it('should update isUndoing state', () => {
      const { result } = renderHook(() => useHistoryStore());

      act(() => {
        result.current.setIsUndoing(true);
      });
      expect(result.current.isUndoing).toBe(true);

      act(() => {
        result.current.setIsUndoing(false);
      });
      expect(result.current.isUndoing).toBe(false);
    });
  });

  describe('setIsLoading', () => {
    it('should update isLoading state', () => {
      const { result } = renderHook(() => useHistoryStore());

      act(() => {
        result.current.setIsLoading(true);
      });
      expect(result.current.isLoading).toBe(true);

      act(() => {
        result.current.setIsLoading(false);
      });
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('setError', () => {
    it('should set error message', () => {
      const { result } = renderHook(() => useHistoryStore());

      act(() => {
        result.current.setError('Something went wrong');
      });
      expect(result.current.error).toBe('Something went wrong');
    });

    it('should clear error with null', () => {
      const { result } = renderHook(() => useHistoryStore());

      act(() => {
        result.current.setError('Error');
      });
      act(() => {
        result.current.setError(null);
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('clearHistory', () => {
    it('should clear all entries', () => {
      const { result } = renderHook(() => useHistoryStore());

      act(() => {
        result.current.setEntries([createMockEntry(), createMockEntry()]);
        result.current.setError('Some error');
      });

      act(() => {
        result.current.clearHistory();
      });

      expect(result.current.entries).toEqual([]);
      expect(result.current.error).toBeNull();
    });
  });
});

describe('useCanUndo', () => {
  beforeEach(() => {
    useHistoryStore.getState().clearHistory();
  });

  it('should return false when no entries', () => {
    const { result } = renderHook(() => useCanUndo());
    expect(result.current).toBe(false);
  });

  it('should return true when entries exist', () => {
    act(() => {
      useHistoryStore.getState().addEntry(createMockEntry());
    });

    const { result } = renderHook(() => useCanUndo());
    expect(result.current).toBe(true);
  });
});

describe('useLatestEntry', () => {
  beforeEach(() => {
    useHistoryStore.getState().clearHistory();
  });

  it('should return null when no entries', () => {
    const { result } = renderHook(() => useLatestEntry());
    expect(result.current).toBeNull();
  });

  it('should return the first entry', () => {
    const entry = createMockEntry({ id: 'latest-entry' });
    act(() => {
      useHistoryStore.getState().addEntry(entry);
    });

    const { result } = renderHook(() => useLatestEntry());
    expect(result.current?.id).toBe('latest-entry');
  });
});

describe('useHistoryCount', () => {
  beforeEach(() => {
    useHistoryStore.getState().clearHistory();
  });

  it('should return 0 when no entries', () => {
    const { result } = renderHook(() => useHistoryCount());
    expect(result.current).toBe(0);
  });

  it('should return correct count', () => {
    act(() => {
      const store = useHistoryStore.getState();
      store.addEntry(createMockEntry());
      store.addEntry(createMockEntry());
      store.addEntry(createMockEntry());
    });

    const { result } = renderHook(() => useHistoryCount());
    expect(result.current).toBe(3);
  });
});
