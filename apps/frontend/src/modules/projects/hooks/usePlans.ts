/**
 * Plans Data Hooks
 * React Query hooks for plan operations including PDF uploads with optimistic updates
 */

import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { plansApi } from '../api/plansApi';
import type {
  Plan,
  PaginatedPlansResponse,
  PaginationParams,
} from '../types';

/**
 * Query Keys Factory
 */
export const planKeys = {
  all: ['plans'] as const,
  lists: () => [...planKeys.all, 'list'] as const,
  list: (projectId: string, params?: PaginationParams) =>
    [...planKeys.lists(), projectId, params] as const,
  details: () => [...planKeys.all, 'detail'] as const,
  detail: (projectId: string, planId: string) => [...planKeys.details(), projectId, planId] as const,
};

/**
 * Helper to update cache after mutations
 */
function updatePlanListCache(
  queryClient: QueryClient,
  projectId: string,
  updater: (oldData: PaginatedPlansResponse | undefined) => PaginatedPlansResponse | undefined,
) {
  // Update all list queries for this project
  queryClient.setQueriesData<PaginatedPlansResponse>(
    { queryKey: planKeys.lists(), predicate: (query) => query.queryKey[2] === projectId },
    updater,
  );
}

/**
 * Hook to fetch plans list with pagination
 */
export function usePlans(projectId: string, params?: PaginationParams) {
  return useQuery({
    queryKey: planKeys.list(projectId, params),
    queryFn: () => plansApi.list(projectId, params),
    enabled: !!projectId,
  });
}

/**
 * Hook to fetch a single plan
 */
export function usePlan(projectId: string, planId: string) {
  return useQuery({
    queryKey: planKeys.detail(projectId, planId),
    queryFn: () => plansApi.get(projectId, planId),
    enabled: !!projectId && !!planId,
  });
}

/**
 * Hook to upload a plan with optimistic updates
 */
export function useUploadPlan(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => plansApi.upload(projectId, file),

    // Optimistic update
    onMutate: async (file) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: planKeys.lists() });

      // Snapshot previous value
      const previousPlans = queryClient.getQueriesData<PaginatedPlansResponse>({
        queryKey: planKeys.lists(),
      });

      // Optimistically update list
      updatePlanListCache(queryClient, projectId, (old) => {
        if (!old) return old;

        const optimisticPlan: Plan = {
          id: `temp-${Date.now()}`,
          projectId,
          name: file.name,
          pageNumber: 1,
          pageCount: 0, // Will be updated when real data arrives
          filePath: '', // Will be set by backend
          fileSize: file.size,
          fileHash: '', // Will be set by backend
          width: null,
          height: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        return {
          ...old,
          items: [optimisticPlan, ...old.items],
          pagination: {
            ...old.pagination,
            count: old.pagination.count + 1,
          },
        };
      });

      return { previousPlans };
    },

    // Rollback on error
    onError: (_err, _file, context) => {
      if (context?.previousPlans) {
        context.previousPlans.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },

    // Refetch on success
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: planKeys.lists() });
    },
  });
}

/**
 * Hook to delete a plan with optimistic updates
 */
export function useDeletePlan(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (planId: string) => plansApi.delete(projectId, planId),

    // Optimistic update
    onMutate: async (planId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: planKeys.lists() });

      // Snapshot previous values
      const previousPlans = queryClient.getQueriesData<PaginatedPlansResponse>({
        queryKey: planKeys.lists(),
      });

      // Optimistically update list
      updatePlanListCache(queryClient, projectId, (old) => {
        if (!old) return old;

        return {
          ...old,
          items: old.items.filter((plan) => plan.id !== planId),
          pagination: {
            ...old.pagination,
            count: Math.max(0, old.pagination.count - 1),
          },
        };
      });

      return { previousPlans };
    },

    // Rollback on error
    onError: (_err, _planId, context) => {
      if (context?.previousPlans) {
        context.previousPlans.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },

    // Refetch on success
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: planKeys.lists() });
    },
  });
}
