/**
 * Stamp Mutations Tests
 * Tests for React Query stamp mutations with optimistic updates
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { useCreateStampMutation, useUpdateStampMutation, useDeleteStampMutation } from '../hooks/useStampMutations';
import { useStampStore } from '../state/useStampStore';
import { stampsApi } from '../api/stampsApi';
import type { Stamp } from '../types';

// Mock the stamps API
vi.mock('../api/stampsApi', () => ({
  stampsApi: {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// Test wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  }

  return Wrapper;
}

// Mock stamp data
const mockStamp: Stamp = {
  id: 'stamp-123',
  planId: 'plan-1',
  deviceId: 'device-1',
  locationId: null,
  position: { x: 100, y: 200, page: 1 },
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
};

describe('useStampMutations', () => {
  beforeEach(() => {
    // Reset store before each test
    const { result } = renderHook(() => useStampStore());
    act(() => {
      result.current.clearStamps();
      result.current.clearSelection();
    });

    // Clear all mocks
    vi.clearAllMocks();
  });

  describe('useCreateStampMutation', () => {
    it('creates a stamp and adds it to store optimistically', async () => {
      const createSpy = vi.spyOn(stampsApi, 'create');
      createSpy.mockResolvedValueOnce(mockStamp);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useCreateStampMutation('plan-1', 'project-1'), { wrapper });

      // Check initial store state
      const { result: stampsResult } = renderHook(() => useStampStore((state) => state.stamps));
      expect(stampsResult.current.size).toBe(0);

      // Trigger mutation
      act(() => {
        result.current.mutate({
          deviceId: 'device-1',
          position: { x: 100, y: 200, page: 1 },
        });
      });

      // Check optimistic update (temp stamp added)
      await waitFor(() => {
        const { result: updatedStamps } = renderHook(() => useStampStore((state) => state.stamps));
        expect(updatedStamps.current.size).toBeGreaterThan(0);
      });

      // Wait for mutation to complete
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Check API was called
      expect(createSpy).toHaveBeenCalledWith('plan-1', {
        deviceId: 'device-1',
        position: { x: 100, y: 200, page: 1 },
      });

      // Check real stamp replaced temp stamp
      const finalStamps = useStampStore.getState().stamps;
      const stamp = finalStamps.get(mockStamp.id);
      expect(stamp).toBeDefined();
      expect(stamp?.id).toBe(mockStamp.id);
    });

    it('rolls back optimistic update on error', async () => {
      const createSpy = vi.spyOn(stampsApi, 'create');
      createSpy.mockRejectedValueOnce(new Error('API Error'));

      const wrapper = createWrapper();
      const { result } = renderHook(() => useCreateStampMutation('plan-1', 'project-1'), { wrapper });

      // Trigger mutation
      act(() => {
        result.current.mutate({
          deviceId: 'device-1',
          position: { x: 100, y: 200, page: 1 },
        });
      });

      // Wait for mutation to fail
      await waitFor(() => expect(result.current.isError).toBe(true));

      // Check store is empty (optimistic update rolled back)
      const finalStamps = useStampStore.getState().stamps;
      expect(finalStamps.size).toBe(0);
    });
  });

  describe('useUpdateStampMutation', () => {
    beforeEach(() => {
      // Add a stamp to the store
      const addStamp = useStampStore.getState().addStamp;
      addStamp(mockStamp);
    });

    it('updates a stamp optimistically', async () => {
      const updatedStamp = { ...mockStamp, position: { ...mockStamp.position, x: 300, y: 400 } };
      const updateSpy = vi.spyOn(stampsApi, 'update');
      updateSpy.mockResolvedValueOnce(updatedStamp);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useUpdateStampMutation('plan-1', 'project-1'), { wrapper });

      // Trigger mutation
      act(() => {
        result.current.mutate({
          stampId: mockStamp.id,
          data: { position: { x: 300, y: 400, page: 1 } },
        });
      });

      // Check optimistic update
      await waitFor(() => {
        const stamp = useStampStore.getState().stamps.get(mockStamp.id);
        expect(stamp?.position.x).toBe(300);
      });

      // Wait for mutation to complete
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Check API was called
      expect(updateSpy).toHaveBeenCalledWith('plan-1', mockStamp.id, {
        position: { x: 300, y: 400, page: 1 },
      });
    });

    it('rolls back update on error', async () => {
      const updateSpy = vi.spyOn(stampsApi, 'update');
      updateSpy.mockRejectedValueOnce(new Error('API Error'));

      const wrapper = createWrapper();
      const { result } = renderHook(() => useUpdateStampMutation('plan-1', 'project-1'), { wrapper });

      // Trigger mutation
      act(() => {
        result.current.mutate({
          stampId: mockStamp.id,
          data: { position: { x: 300, y: 400, page: 1 } },
        });
      });

      // Wait for mutation to fail
      await waitFor(() => expect(result.current.isError).toBe(true));

      // Check original position was restored
      const stamp = useStampStore.getState().stamps.get(mockStamp.id);
      expect(stamp?.position.x).toBe(100);
      expect(stamp?.position.y).toBe(200);
    });
  });

  describe('useDeleteStampMutation', () => {
    beforeEach(() => {
      // Add a stamp to the store
      const addStamp = useStampStore.getState().addStamp;
      addStamp(mockStamp);
    });

    it('deletes a stamp optimistically', async () => {
      const deleteSpy = vi.spyOn(stampsApi, 'delete');
      deleteSpy.mockResolvedValueOnce(undefined);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useDeleteStampMutation('plan-1', 'project-1'), { wrapper });

      // Trigger mutation
      act(() => {
        result.current.mutate(mockStamp.id);
      });

      // Check optimistic deletion
      await waitFor(() => {
        const stamps = useStampStore.getState().stamps;
        expect(stamps.has(mockStamp.id)).toBe(false);
      });

      // Wait for mutation to complete
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Check API was called
      expect(deleteSpy).toHaveBeenCalledWith('plan-1', mockStamp.id);
    });

    it('restores stamp on error', async () => {
      const deleteSpy = vi.spyOn(stampsApi, 'delete');
      deleteSpy.mockRejectedValueOnce(new Error('API Error'));

      const wrapper = createWrapper();
      const { result } = renderHook(() => useDeleteStampMutation('plan-1', 'project-1'), { wrapper });

      // Trigger mutation
      act(() => {
        result.current.mutate(mockStamp.id);
      });

      // Wait for mutation to fail
      await waitFor(() => expect(result.current.isError).toBe(true));

      // Check stamp was restored
      const stamps = useStampStore.getState().stamps;
      expect(stamps.has(mockStamp.id)).toBe(true);
    });
  });
});
