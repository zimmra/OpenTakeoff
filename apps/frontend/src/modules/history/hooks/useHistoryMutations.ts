/**
 * History Mutations
 * React Query mutations for undo/redo operations with state synchronization
 */

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { historyApi } from '../api/historyApi';
import { useHistoryStore } from '../state/useHistoryStore';
import { useStampStore } from '../../stamps/state/useStampStore';
import { useLocationStore } from '../../locations/state/useLocationStore';
import type { Stamp } from '../../stamps/types';

/**
 * Query keys for history queries
 */
export const historyKeys = {
  all: ['history'] as const,
  lists: () => [...historyKeys.all, 'list'] as const,
  list: (projectId: string) => [...historyKeys.lists(), projectId] as const,
};

/**
 * Query to fetch and sync history entries
 */
export function useHistoryQuery(projectId: string | undefined, enabled = true) {
  const setEntries = useHistoryStore((state) => state.setEntries);
  const setIsLoading = useHistoryStore((state) => state.setIsLoading);
  const setError = useHistoryStore((state) => state.setError);

  const query = useQuery({
    queryKey: historyKeys.list(projectId ?? ''),
    queryFn: async () => {
      if (!projectId) throw new Error('Project ID is required');
      setIsLoading(true);
      try {
        const response = await historyApi.list(projectId);
        return response.entries;
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to load history');
        throw error;
      }
    },
    enabled: enabled && !!projectId,
    refetchInterval: false, // Don't auto-refetch
    staleTime: 30000, // Consider data fresh for 30 seconds
  });

  // Sync data to store when query succeeds
  useEffect(() => {
    if (query.isSuccess) {
      setEntries(query.data);
      setIsLoading(false);
      setError(null);
    }
  }, [query.isSuccess, query.data, setEntries, setIsLoading, setError]);

  return query;
}

/**
 * Undo mutation with state synchronization
 */
export function useUndoMutation(projectId: string) {
  const queryClient = useQueryClient();
  const setIsUndoing = useHistoryStore((state) => state.setIsUndoing);
  const removeLatestEntry = useHistoryStore((state) => state.removeLatestEntry);
  const setError = useHistoryStore((state) => state.setError);

  // Get store actions - use individual selectors to avoid creating new objects
  // that would trigger infinite re-renders (Zustand uses Object.is comparison)
  const updateStamp = useStampStore((state) => state.updateStamp);
  const removeStamp = useStampStore((state) => state.removeStamp);
  const updateLocation = useLocationStore((state) => state.updateLocation);
  const removeLocation = useLocationStore((state) => state.removeLocation);

  return useMutation({
    mutationFn: () => historyApi.undo(projectId),

    onMutate: () => {
      setIsUndoing(true);
      setError(null);
    },

    onSuccess: (result) => {
      // Update local state based on undo result
      if (result.entityType === 'stamp') {
        // Handle stamp undo
        if (result.restoredState) {
          // Updated or recreated stamp
          const stamp = result.restoredState as Stamp;
          updateStamp(stamp.id, stamp);
        } else {
          // Deleted stamp (was a create, so remove it)
          removeStamp(result.entityId);
        }
      }
      // Handle location undo
      if (result.restoredState) {
        // Updated or recreated location
        const location = result.restoredState as Record<string, unknown> & { id: string };
        updateLocation(location.id, location);
      } else {
        // Deleted location (was a create, so remove it)
        removeLocation(result.entityId);
      }

      // Remove the undone entry from history
      removeLatestEntry();

      // Invalidate queries to refetch fresh data
      void queryClient.invalidateQueries({ queryKey: historyKeys.list(projectId) });

      setIsUndoing(false);
    },

    onError: (error: Error) => {
      setIsUndoing(false);
      setError(error.message);
    },
  });
}

/**
 * Prune history mutation
 */
export function usePruneHistoryMutation(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => historyApi.prune(projectId),

    onSuccess: () => {
      // Invalidate history queries after pruning
      void queryClient.invalidateQueries({ queryKey: historyKeys.list(projectId) });
    },
  });
}
