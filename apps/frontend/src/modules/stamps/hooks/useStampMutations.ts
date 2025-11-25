/**
 * Stamp Mutations
 * React Query mutations for stamp CRUD operations with optimistic updates
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { stampsApi, type CreateStampRequest, type UpdateStampRequest } from '../api/stampsApi';
import { useStampStore } from '../state/useStampStore';
import { historyKeys } from '../../history/hooks/useHistoryMutations';
import type { Stamp } from '../types';

/**
 * Query keys for stamp queries
 */
export const stampKeys = {
  all: ['stamps'] as const,
  lists: () => [...stampKeys.all, 'list'] as const,
  list: (planId: string) => [...stampKeys.lists(), planId] as const,
  details: () => [...stampKeys.all, 'detail'] as const,
  detail: (planId: string, stampId: string) => [...stampKeys.details(), planId, stampId] as const,
};

/**
 * Create stamp mutation with optimistic updates
 */
export function useCreateStampMutation(planId: string, projectId: string) {
  const queryClient = useQueryClient();
  const addStamp = useStampStore((state) => state.addStamp);

  return useMutation({
    mutationFn: (data: CreateStampRequest) => stampsApi.create(planId, data),

    // Optimistic update: add stamp to store immediately
    onMutate: (newStamp) => {
      // Generate temporary ID for optimistic update
      const tempId = `temp-${Date.now()}`;
      const optimisticStamp: Stamp = {
        id: tempId,
        planId,
        deviceId: newStamp.deviceId,
        locationId: newStamp.locationId ?? null,
        position: newStamp.position,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Add to Zustand store
      addStamp(optimisticStamp);

      // Return context for rollback
      return { tempId, optimisticStamp };
    },

    // On success, replace temporary stamp with server response
    onSuccess: (data, _variables, context) => {
      const { tempId } = context;
      const removeStamp = useStampStore.getState().removeStamp;
      const addStamp = useStampStore.getState().addStamp;

      // Remove temp stamp and add real stamp
      removeStamp(tempId);
      addStamp(data);

      // Invalidate queries to refetch
      void queryClient.invalidateQueries({ queryKey: stampKeys.list(planId) });
      void queryClient.invalidateQueries({ queryKey: historyKeys.list(projectId) });
    },

    // On error, remove optimistic stamp
    onError: (_error, _variables, context) => {
      if (context?.tempId) {
        const removeStamp = useStampStore.getState().removeStamp;
        removeStamp(context.tempId);
      }
    },
  });
}

/**
 * Update stamp mutation with optimistic updates
 */
export function useUpdateStampMutation(planId: string, projectId: string) {
  const queryClient = useQueryClient();
  const updateStamp = useStampStore((state) => state.updateStamp);

  return useMutation({
    mutationFn: ({ stampId, data }: { stampId: string; data: UpdateStampRequest }) =>
      stampsApi.update(planId, stampId, data),

    // Optimistic update: update stamp in store immediately
    onMutate: ({ stampId, data }) => {
      const currentStamp = useStampStore.getState().stamps.get(stampId);
      if (!currentStamp) return undefined;

      // Store previous value for rollback
      const previousStamp = { ...currentStamp };

      // Update stamp optimistically
      updateStamp(stampId, data);

      return { previousStamp };
    },

    // On success, update with server response
    onSuccess: (data, _variables) => {
      updateStamp(data.id, data);

      // Invalidate queries
      void queryClient.invalidateQueries({ queryKey: stampKeys.list(planId) });
      void queryClient.invalidateQueries({ queryKey: stampKeys.detail(planId, data.id) });
      void queryClient.invalidateQueries({ queryKey: historyKeys.list(projectId) });
    },

    // On error, rollback to previous state
    onError: (_error, variables, context) => {
      if (context?.previousStamp) {
        updateStamp(variables.stampId, context.previousStamp);
      }
    },
  });
}

/**
 * Delete stamp mutation with optimistic updates
 */
export function useDeleteStampMutation(planId: string, projectId: string) {
  const queryClient = useQueryClient();
  const removeStamp = useStampStore((state) => state.removeStamp);
  const addStamp = useStampStore((state) => state.addStamp);

  return useMutation({
    mutationFn: (stampId: string) => stampsApi.delete(planId, stampId),

    // Optimistic update: remove stamp from store immediately
    onMutate: (stampId) => {
      const currentStamp = useStampStore.getState().stamps.get(stampId);
      if (!currentStamp) return undefined;

      // Store previous value for rollback
      const previousStamp = { ...currentStamp };

      // Remove stamp optimistically
      removeStamp(stampId);

      return { previousStamp };
    },

    // On success, invalidate queries
    onSuccess: (_data, stampId) => {
      void queryClient.invalidateQueries({ queryKey: stampKeys.list(planId) });
      void queryClient.invalidateQueries({ queryKey: stampKeys.detail(planId, stampId) });
      void queryClient.invalidateQueries({ queryKey: historyKeys.list(projectId) });
    },

    // On error, restore previous stamp
    onError: (_error, _variables, context) => {
      if (context?.previousStamp) {
        addStamp(context.previousStamp);
      }
    },
  });
}
