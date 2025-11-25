/**
 * Stamp Store Tests
 * Tests for Zustand stamp state management
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useStampStore,
  useStamps,
  useStamp,
  useSelectedStamp,
  useStampsForPlan,
} from '../state/useStampStore';
import type { Stamp } from '../types';

// Mock stamp data
const createMockStamp = (overrides: Partial<Stamp> = {}): Stamp => ({
  id: 'stamp-1',
  planId: 'plan-1',
  deviceId: 'device-1',
  position: { x: 100, y: 200, page: 1 },
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  ...overrides,
});

describe('useStampStore', () => {
  beforeEach(() => {
    // Reset store before each test
    const { result } = renderHook(() => useStampStore());
    act(() => {
      result.current.clearStamps();
      result.current.clearSelection();
      result.current.setPlacementMode(false);
      result.current.setSnapToGrid(false);
    });
  });

  describe('Stamp entity management', () => {
    it('initializes with empty stamps', () => {
      const { result } = renderHook(() => useStamps());
      expect(result.current).toEqual([]);
    });

    it('sets stamps from array', () => {
      const stamps = [createMockStamp({ id: 'stamp-1' }), createMockStamp({ id: 'stamp-2' })];

      const { result } = renderHook(() => useStampStore());

      act(() => {
        result.current.setStamps(stamps);
      });

      const { result: stampsResult } = renderHook(() => useStamps());
      expect(stampsResult.current).toHaveLength(2);
      expect(stampsResult.current[0]?.id).toBe('stamp-1');
      expect(stampsResult.current[1]?.id).toBe('stamp-2');
    });

    it('adds a new stamp', () => {
      const stamp = createMockStamp();
      const { result } = renderHook(() => useStampStore());

      act(() => {
        result.current.addStamp(stamp);
      });

      const { result: stampsResult } = renderHook(() => useStamps());
      expect(stampsResult.current).toHaveLength(1);
      expect(stampsResult.current[0]?.id).toBe(stamp.id);
    });

    it('updates an existing stamp', () => {
      const stamp = createMockStamp();
      const { result } = renderHook(() => useStampStore());

      act(() => {
        result.current.addStamp(stamp);
        result.current.updateStamp(stamp.id, {
          position: { x: 300, y: 400, page: 2 },
        });
      });

      const { result: stampResult } = renderHook(() => useStamp(stamp.id));
      expect(stampResult.current?.position.x).toBe(300);
      expect(stampResult.current?.position.y).toBe(400);
      expect(stampResult.current?.position.page).toBe(2);
    });

    it('removes a stamp', () => {
      const stamp = createMockStamp();
      const { result } = renderHook(() => useStampStore());

      act(() => {
        result.current.addStamp(stamp);
        result.current.removeStamp(stamp.id);
      });

      const { result: stampsResult } = renderHook(() => useStamps());
      expect(stampsResult.current).toHaveLength(0);
    });

    it('clears all stamps', () => {
      const stamps = [createMockStamp({ id: 'stamp-1' }), createMockStamp({ id: 'stamp-2' })];
      const { result } = renderHook(() => useStampStore());

      act(() => {
        result.current.setStamps(stamps);
        result.current.clearStamps();
      });

      const { result: stampsResult } = renderHook(() => useStamps());
      expect(stampsResult.current).toHaveLength(0);
    });
  });

  describe('Selection management', () => {
    it('initializes with no selection', () => {
      const { result } = renderHook(() => useStampStore());
      expect(result.current.selectedStampId).toBeNull();
    });

    it('selects a stamp', () => {
      const stamp = createMockStamp();
      const { result } = renderHook(() => useStampStore());

      act(() => {
        result.current.addStamp(stamp);
        result.current.selectStamp(stamp.id);
      });

      expect(result.current.selectedStampId).toBe(stamp.id);

      const { result: selectedResult } = renderHook(() => useSelectedStamp());
      expect(selectedResult.current?.id).toBe(stamp.id);
    });

    it('clears selection', () => {
      const stamp = createMockStamp();
      const { result } = renderHook(() => useStampStore());

      act(() => {
        result.current.addStamp(stamp);
        result.current.selectStamp(stamp.id);
        result.current.clearSelection();
      });

      expect(result.current.selectedStampId).toBeNull();
    });

    it('clears selection when removing selected stamp', () => {
      const stamp = createMockStamp();
      const { result } = renderHook(() => useStampStore());

      act(() => {
        result.current.addStamp(stamp);
        result.current.selectStamp(stamp.id);
        result.current.removeStamp(stamp.id);
      });

      expect(result.current.selectedStampId).toBeNull();
    });
  });

  describe('Interaction state', () => {
    it('toggles placement mode', () => {
      const { result } = renderHook(() => useStampStore());

      expect(result.current.isPlacementMode).toBe(false);

      act(() => {
        result.current.setPlacementMode(true);
      });

      expect(result.current.isPlacementMode).toBe(true);
    });

    it('clears selection when entering placement mode', () => {
      const stamp = createMockStamp();
      const { result } = renderHook(() => useStampStore());

      act(() => {
        result.current.addStamp(stamp);
        result.current.selectStamp(stamp.id);
        result.current.setPlacementMode(true);
      });

      expect(result.current.selectedStampId).toBeNull();
    });

    it('toggles snap to grid', () => {
      const { result } = renderHook(() => useStampStore());

      expect(result.current.snapToGrid).toBe(false);

      act(() => {
        result.current.toggleSnapToGrid();
      });

      expect(result.current.snapToGrid).toBe(true);

      act(() => {
        result.current.toggleSnapToGrid();
      });

      expect(result.current.snapToGrid).toBe(false);
    });

    it('sets snap to grid directly', () => {
      const { result } = renderHook(() => useStampStore());

      act(() => {
        result.current.setSnapToGrid(true);
      });

      expect(result.current.snapToGrid).toBe(true);
    });

    it('sets grid size', () => {
      const { result } = renderHook(() => useStampStore());

      act(() => {
        result.current.setGridSize(432); // 6 inches at 72 ppi
      });

      expect(result.current.gridSize).toBe(432);
    });
  });

  describe('Selector hooks', () => {
    it('useStamp returns stamp by ID', () => {
      const stamp = createMockStamp();
      const { result: storeResult } = renderHook(() => useStampStore());

      act(() => {
        storeResult.current.addStamp(stamp);
      });

      const { result } = renderHook(() => useStamp(stamp.id));
      expect(result.current?.id).toBe(stamp.id);
    });

    it('useStamp returns null for non-existent ID', () => {
      const { result } = renderHook(() => useStamp('non-existent'));
      expect(result.current).toBeUndefined();
    });

    it('useStampsForPlan filters by plan ID', () => {
      const stamps = [
        createMockStamp({ id: 'stamp-1', planId: 'plan-1' }),
        createMockStamp({ id: 'stamp-2', planId: 'plan-2' }),
        createMockStamp({ id: 'stamp-3', planId: 'plan-1' }),
      ];

      const { result: storeResult } = renderHook(() => useStampStore());

      act(() => {
        storeResult.current.setStamps(stamps);
      });

      const { result } = renderHook(() => useStampsForPlan('plan-1'));
      expect(result.current).toHaveLength(2);
      expect(result.current[0]?.planId).toBe('plan-1');
      expect(result.current[1]?.planId).toBe('plan-1');
    });
  });
});
