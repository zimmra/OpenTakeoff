/**
 * Device Data Hooks
 * React Query hooks for device CRUD operations with optimistic updates
 */

import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { devicesApi } from '../api/devicesApi';
import type {
  Device,
  CreateDeviceInput,
  UpdateDeviceInput,
  PaginatedDevicesResponse,
  PaginationParams,
} from '../types';

/**
 * Query Keys Factory
 */
export const deviceKeys = {
  all: ['devices'] as const,
  lists: () => [...deviceKeys.all, 'list'] as const,
  list: (projectId: string, params?: PaginationParams) =>
    [...deviceKeys.lists(), projectId, params] as const,
  details: () => [...deviceKeys.all, 'detail'] as const,
  detail: (deviceId: string) => [...deviceKeys.details(), deviceId] as const,
}

/**
 * React Query Hooks
 */

/**
 * Hook to fetch devices list with pagination
 */
export function useDevices(projectId: string, params?: PaginationParams) {
  return useQuery({
    queryKey: deviceKeys.list(projectId, params),
    queryFn: () => devicesApi.list(projectId, params),
    enabled: !!projectId,
  });
}

/**
 * Hook to fetch a single device
 * Note: Requires projectId to construct the API path correctly
 */
export function useDevice(projectId: string, deviceId: string) {
  return useQuery({
    queryKey: deviceKeys.detail(deviceId),
    queryFn: () => devicesApi.get(projectId, deviceId),
    enabled: !!projectId && !!deviceId,
  });
}

/**
 * Helper to update cache after mutations
 */
function updateDeviceListCache(
  queryClient: QueryClient,
  projectId: string,
  updater: (oldData: PaginatedDevicesResponse | undefined) => PaginatedDevicesResponse | undefined,
) {
  // Update all list queries for this project
  queryClient.setQueriesData<PaginatedDevicesResponse>(
    { queryKey: deviceKeys.lists(), predicate: (query) => query.queryKey[2] === projectId },
    updater,
  );
}

/**
 * Hook to create a device with optimistic updates
 */
export function useCreateDevice(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateDeviceInput) => devicesApi.create(projectId, input),

    // Optimistic update
    onMutate: async (newDevice) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: deviceKeys.lists() });

      // Snapshot previous value
      const previousDevices = queryClient.getQueriesData<PaginatedDevicesResponse>({
        queryKey: deviceKeys.lists(),
      });

      // Optimistically update list
      updateDeviceListCache(queryClient, projectId, (old) => {
        if (!old) return old;

        const optimisticDevice: Device = {
          id: `temp-${Date.now()}`,
          projectId,
          name: newDevice.name,
          description: newDevice.description ?? null,
          color: newDevice.color ?? null,
          iconKey: newDevice.iconKey ?? null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        return {
          ...old,
          items: [optimisticDevice, ...old.items],
          pagination: {
            ...old.pagination,
            count: old.pagination.count + 1,
          },
        };
      });

      return { previousDevices };
    },

    // Rollback on error
    onError: (_err, _newDevice, context) => {
      if (context?.previousDevices) {
        context.previousDevices.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },

    // Refetch on success
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: deviceKeys.lists() });
    },
  });
}

/**
 * Hook to update a device with optimistic updates
 */
export function useUpdateDevice(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ deviceId, input }: { deviceId: string; input: UpdateDeviceInput }) =>
      devicesApi.update(projectId, deviceId, input),

    // Optimistic update
    onMutate: async ({ deviceId, input }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: deviceKeys.lists() });
      await queryClient.cancelQueries({ queryKey: deviceKeys.detail(deviceId) });

      // Snapshot previous values
      const previousDevices = queryClient.getQueriesData<PaginatedDevicesResponse>({
        queryKey: deviceKeys.lists(),
      });
      const previousDevice = queryClient.getQueryData<Device>(deviceKeys.detail(deviceId));

      // Optimistically update list
      updateDeviceListCache(queryClient, projectId, (old) => {
        if (!old) return old;

        return {
          ...old,
          items: old.items.map((device) =>
            device.id === deviceId
              ? {
                  ...device,
                  ...input,
                  updatedAt: new Date().toISOString(),
                }
              : device,
          ),
        };
      });

      // Optimistically update detail
      if (previousDevice) {
        queryClient.setQueryData<Device>(deviceKeys.detail(deviceId), {
          ...previousDevice,
          ...input,
          updatedAt: new Date().toISOString(),
        });
      }

      return { previousDevices, previousDevice };
    },

    // Rollback on error
    onError: (_err, { deviceId }, context) => {
      if (context?.previousDevices) {
        context.previousDevices.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousDevice) {
        queryClient.setQueryData(deviceKeys.detail(deviceId), context.previousDevice);
      }
    },

    // Refetch on success
    onSuccess: (_data, { deviceId }) => {
      void queryClient.invalidateQueries({ queryKey: deviceKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: deviceKeys.detail(deviceId) });
    },
  });
}

/**
 * Hook to delete a device with optimistic updates
 */
export function useDeleteDevice(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (deviceId: string) => devicesApi.delete(projectId, deviceId),

    // Optimistic update
    onMutate: async (deviceId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: deviceKeys.lists() });

      // Snapshot previous values
      const previousDevices = queryClient.getQueriesData<PaginatedDevicesResponse>({
        queryKey: deviceKeys.lists(),
      });

      // Optimistically update list
      updateDeviceListCache(queryClient, projectId, (old) => {
        if (!old) return old;

        return {
          ...old,
          items: old.items.filter((device) => device.id !== deviceId),
          pagination: {
            ...old.pagination,
            count: Math.max(0, old.pagination.count - 1),
          },
        };
      });

      return { previousDevices };
    },

    // Rollback on error
    onError: (_err, _deviceId, context) => {
      if (context?.previousDevices) {
        context.previousDevices.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },

    // Refetch on success
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: deviceKeys.lists() });
    },
  });
}
