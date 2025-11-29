/**
 * Device Visibility Store Tests
 * Tests for the device visibility state management
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDeviceVisibilityStore } from '../useDeviceVisibilityStore';

describe('useDeviceVisibilityStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useDeviceVisibilityStore.getState().showAll();
  });

  describe('initial state', () => {
    it('should have empty hiddenDeviceIds set', () => {
      const { result } = renderHook(() => useDeviceVisibilityStore());
      expect(result.current.hiddenDeviceIds.size).toBe(0);
    });
  });

  describe('toggleVisibility', () => {
    it('should hide a visible device', () => {
      const { result } = renderHook(() => useDeviceVisibilityStore());

      act(() => {
        result.current.toggleVisibility('device-1');
      });

      expect(result.current.hiddenDeviceIds.has('device-1')).toBe(true);
      expect(result.current.isDeviceVisible('device-1')).toBe(false);
    });

    it('should show a hidden device', () => {
      const { result } = renderHook(() => useDeviceVisibilityStore());

      // First hide the device
      act(() => {
        result.current.toggleVisibility('device-1');
      });
      expect(result.current.isDeviceVisible('device-1')).toBe(false);

      // Then show it again
      act(() => {
        result.current.toggleVisibility('device-1');
      });
      expect(result.current.isDeviceVisible('device-1')).toBe(true);
    });

    it('should toggle multiple devices independently', () => {
      const { result } = renderHook(() => useDeviceVisibilityStore());

      act(() => {
        result.current.toggleVisibility('device-1');
        result.current.toggleVisibility('device-2');
      });

      expect(result.current.isDeviceVisible('device-1')).toBe(false);
      expect(result.current.isDeviceVisible('device-2')).toBe(false);
      expect(result.current.isDeviceVisible('device-3')).toBe(true);

      act(() => {
        result.current.toggleVisibility('device-1');
      });

      expect(result.current.isDeviceVisible('device-1')).toBe(true);
      expect(result.current.isDeviceVisible('device-2')).toBe(false);
    });
  });

  describe('showAll', () => {
    it('should clear all hidden devices', () => {
      const { result } = renderHook(() => useDeviceVisibilityStore());

      // Hide several devices
      act(() => {
        result.current.toggleVisibility('device-1');
        result.current.toggleVisibility('device-2');
        result.current.toggleVisibility('device-3');
      });

      expect(result.current.hiddenDeviceIds.size).toBe(3);

      // Show all
      act(() => {
        result.current.showAll();
      });

      expect(result.current.hiddenDeviceIds.size).toBe(0);
      expect(result.current.isDeviceVisible('device-1')).toBe(true);
      expect(result.current.isDeviceVisible('device-2')).toBe(true);
      expect(result.current.isDeviceVisible('device-3')).toBe(true);
    });

    it('should handle being called when no devices are hidden', () => {
      const { result } = renderHook(() => useDeviceVisibilityStore());

      act(() => {
        result.current.showAll();
      });

      expect(result.current.hiddenDeviceIds.size).toBe(0);
    });
  });

  describe('hideAll', () => {
    it('should hide all specified devices', () => {
      const { result } = renderHook(() => useDeviceVisibilityStore());

      act(() => {
        result.current.hideAll(['device-1', 'device-2', 'device-3']);
      });

      expect(result.current.hiddenDeviceIds.size).toBe(3);
      expect(result.current.isDeviceVisible('device-1')).toBe(false);
      expect(result.current.isDeviceVisible('device-2')).toBe(false);
      expect(result.current.isDeviceVisible('device-3')).toBe(false);
    });

    it('should replace existing hidden devices', () => {
      const { result } = renderHook(() => useDeviceVisibilityStore());

      // Initially hide some devices
      act(() => {
        result.current.hideAll(['device-1', 'device-2']);
      });

      expect(result.current.isDeviceVisible('device-1')).toBe(false);
      expect(result.current.isDeviceVisible('device-2')).toBe(false);

      // Hide a different set
      act(() => {
        result.current.hideAll(['device-3', 'device-4']);
      });

      // Old devices should be visible again
      expect(result.current.isDeviceVisible('device-1')).toBe(true);
      expect(result.current.isDeviceVisible('device-2')).toBe(true);
      // New devices should be hidden
      expect(result.current.isDeviceVisible('device-3')).toBe(false);
      expect(result.current.isDeviceVisible('device-4')).toBe(false);
    });

    it('should handle empty array', () => {
      const { result } = renderHook(() => useDeviceVisibilityStore());

      act(() => {
        result.current.hideAll(['device-1']);
      });
      expect(result.current.hiddenDeviceIds.size).toBe(1);

      act(() => {
        result.current.hideAll([]);
      });

      expect(result.current.hiddenDeviceIds.size).toBe(0);
    });

    it('should handle duplicate device IDs', () => {
      const { result } = renderHook(() => useDeviceVisibilityStore());

      act(() => {
        result.current.hideAll(['device-1', 'device-1', 'device-2', 'device-2']);
      });

      // Set should deduplicate
      expect(result.current.hiddenDeviceIds.size).toBe(2);
    });
  });

  describe('isDeviceVisible', () => {
    it('should return true for devices not in hidden set', () => {
      const { result } = renderHook(() => useDeviceVisibilityStore());
      expect(result.current.isDeviceVisible('any-device')).toBe(true);
    });

    it('should return false for hidden devices', () => {
      const { result } = renderHook(() => useDeviceVisibilityStore());

      act(() => {
        result.current.toggleVisibility('hidden-device');
      });

      expect(result.current.isDeviceVisible('hidden-device')).toBe(false);
    });
  });

  describe('state persistence across renders', () => {
    it('should maintain state when hook is re-rendered', () => {
      const { result, rerender } = renderHook(() => useDeviceVisibilityStore());

      act(() => {
        result.current.toggleVisibility('device-1');
      });

      rerender();

      expect(result.current.isDeviceVisible('device-1')).toBe(false);
    });
  });
});
