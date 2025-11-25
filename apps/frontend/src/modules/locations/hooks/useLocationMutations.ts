/**
 * Location Mutation Hooks
 * React Query mutations for location CRUD operations
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocationStore } from '../state/useLocationStore';
import { apiClient } from '../../../lib/api';
import type {
  Location,
  CreateRectangleLocationInput,
  CreatePolygonLocationInput,
  UpdateLocationInput,
} from '../types';
import * as locationsApi from '../api/locationsApi';

/**
 * Trigger stamp-location association recompute
 */
async function triggerRecompute(planId: string): Promise<void> {
  await apiClient.post(`/plans/${planId}/counts/recompute`, {});
}

/**
 * Query key factory for locations
 */
export const locationKeys = {
  all: ['locations'] as const,
  lists: () => [...locationKeys.all, 'list'] as const,
  list: (planId: string) => [...locationKeys.lists(), planId] as const,
  details: () => [...locationKeys.all, 'detail'] as const,
  detail: (locationId: string) => [...locationKeys.details(), locationId] as const,
};

/**
 * Hook for creating rectangle locations
 */
export function useCreateRectangleLocationMutation(planId: string) {
  const queryClient = useQueryClient();
  const addLocation = useLocationStore((state) => state.addLocation);

  return useMutation({
    mutationFn: (input: CreateRectangleLocationInput) =>
      locationsApi.createRectangleLocation(planId, input),
    onSuccess: async (newLocation) => {
      // Update local store
      addLocation(newLocation);

      // Invalidate locations list query
      void queryClient.invalidateQueries({ queryKey: locationKeys.list(planId) });

      // Trigger stamp-location association recompute
      try {
        await triggerRecompute(planId);
        // Invalidate count queries after recompute
        void queryClient.invalidateQueries({ queryKey: ['counts', planId] });
      } catch (error) {
        console.error('Failed to recompute stamp-location associations:', error);
      }
    },
  });
}

/**
 * Hook for creating polygon locations
 */
export function useCreatePolygonLocationMutation(planId: string) {
  const queryClient = useQueryClient();
  const addLocation = useLocationStore((state) => state.addLocation);

  return useMutation({
    mutationFn: (input: CreatePolygonLocationInput) =>
      locationsApi.createPolygonLocation(planId, input),
    onSuccess: async (newLocation) => {
      // Update local store
      addLocation(newLocation);

      // Invalidate locations list query
      void queryClient.invalidateQueries({ queryKey: locationKeys.list(planId) });

      // Trigger stamp-location association recompute
      try {
        await triggerRecompute(planId);
        // Invalidate count queries after recompute
        void queryClient.invalidateQueries({ queryKey: ['counts', planId] });
      } catch (error) {
        console.error('Failed to recompute stamp-location associations:', error);
      }
    },
  });
}

/**
 * Hook for updating locations
 */
export function useUpdateLocationMutation(planId: string) {
  const queryClient = useQueryClient();
  const updateLocation = useLocationStore((state) => state.updateLocation);

  return useMutation({
    mutationFn: ({ locationId, input }: { locationId: string; input: UpdateLocationInput }) =>
      locationsApi.updateLocation(planId, locationId, input),
    onMutate: async ({ locationId, input }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: locationKeys.detail(locationId) });

      // Snapshot previous value
      const previousLocation = queryClient.getQueryData<Location>(
        locationKeys.detail(locationId)
      );

      // Optimistically update local store
      updateLocation(locationId, input);

      return { previousLocation };
    },
    onError: (_error, { locationId }, context) => {
      // Rollback on error
      if (context?.previousLocation) {
        updateLocation(locationId, context.previousLocation);
      }
    },
    onSuccess: async (updatedLocation) => {
      // Update local store with server response
      updateLocation(updatedLocation.id, updatedLocation);

      // Invalidate queries
      void queryClient.invalidateQueries({ queryKey: locationKeys.list(planId) });
      void queryClient.invalidateQueries({ queryKey: locationKeys.detail(updatedLocation.id) });

      // Trigger stamp-location association recompute
      try {
        await triggerRecompute(planId);
        // Invalidate count queries after recompute
        void queryClient.invalidateQueries({ queryKey: ['counts', planId] });
      } catch (error) {
        console.error('Failed to recompute stamp-location associations:', error);
      }
    },
  });
}

/**
 * Hook for deleting locations
 */
export function useDeleteLocationMutation(planId: string) {
  const queryClient = useQueryClient();
  const removeLocation = useLocationStore((state) => state.removeLocation);

  return useMutation({
    mutationFn: (locationId: string) => locationsApi.deleteLocation(planId, locationId),
    onMutate: async (locationId) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: locationKeys.list(planId) });

      // Snapshot previous value
      const previousLocations = queryClient.getQueryData<Location[]>(locationKeys.list(planId));

      // Optimistically remove from local store
      removeLocation(locationId);

      return { previousLocations };
    },
    onError: (_error, _locationId, context) => {
      // Rollback on error
      if (context?.previousLocations) {
        const setLocations = useLocationStore.getState().setLocations;
        setLocations(context.previousLocations);
      }
    },
    onSuccess: async (_data, locationId) => {
      // Confirm removal in local store
      removeLocation(locationId);

      // Invalidate queries
      void queryClient.invalidateQueries({ queryKey: locationKeys.list(planId) });
      void queryClient.invalidateQueries({ queryKey: locationKeys.detail(locationId) });

      // Trigger stamp-location association recompute
      try {
        await triggerRecompute(planId);
        // Invalidate count queries after recompute
        void queryClient.invalidateQueries({ queryKey: ['counts', planId] });
      } catch (error) {
        console.error('Failed to recompute stamp-location associations:', error);
      }
    },
  });
}

/**
 * Hook for loading locations into the store
 */
export function useLoadLocations(planId: string) {
  const setLocations = useLocationStore((state) => state.setLocations);

  return useMutation({
    mutationFn: () => locationsApi.listLocations(planId),
    onSuccess: (locations) => {
      setLocations(locations);
    },
  });
}
