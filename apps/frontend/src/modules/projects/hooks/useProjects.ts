/**
 * Projects Data Hooks
 * React Query hooks for project CRUD operations with optimistic updates
 */

import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { projectsApi } from '../api/projectsApi';
import type {
  Project,
  CreateProjectInput,
  UpdateProjectInput,
  PaginatedProjectsResponse,
  PaginationParams,
} from '../types';

/**
 * Query Keys Factory
 */
export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (params?: PaginationParams) => [...projectKeys.lists(), params] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (projectId: string) => [...projectKeys.details(), projectId] as const,
};

/**
 * Helper to update cache after mutations
 */
function updateProjectListCache(
  queryClient: QueryClient,
  updater: (oldData: PaginatedProjectsResponse | undefined) => PaginatedProjectsResponse | undefined,
) {
  // Update all list queries
  queryClient.setQueriesData<PaginatedProjectsResponse>(
    { queryKey: projectKeys.lists() },
    updater,
  );
}

/**
 * Hook to fetch projects list with pagination
 */
export function useProjects(params?: PaginationParams) {
  return useQuery({
    queryKey: projectKeys.list(params),
    queryFn: () => projectsApi.list(params),
  });
}

/**
 * Hook to fetch a single project
 */
export function useProject(projectId: string) {
  return useQuery({
    queryKey: projectKeys.detail(projectId),
    queryFn: () => projectsApi.get(projectId),
    enabled: !!projectId,
  });
}

/**
 * Hook to create a project with optimistic updates
 */
export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateProjectInput) => projectsApi.create(input),

    // Optimistic update
    onMutate: async (newProject) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: projectKeys.lists() });

      // Snapshot previous value
      const previousProjects = queryClient.getQueriesData<PaginatedProjectsResponse>({
        queryKey: projectKeys.lists(),
      });

      // Optimistically update list
      updateProjectListCache(queryClient, (old) => {
        if (!old) return old;

        const optimisticProject: Project = {
          id: `temp-${Date.now()}`,
          name: newProject.name,
          description: newProject.description ?? null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        return {
          ...old,
          items: [optimisticProject, ...old.items],
          pagination: {
            ...old.pagination,
            count: old.pagination.count + 1,
          },
        };
      });

      return { previousProjects };
    },

    // Rollback on error
    onError: (_err, _newProject, context) => {
      if (context?.previousProjects) {
        context.previousProjects.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },

    // Refetch on success
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

/**
 * Hook to update a project with optimistic updates
 */
export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, input }: { projectId: string; input: UpdateProjectInput }) =>
      projectsApi.update(projectId, input),

    // Optimistic update
    onMutate: async ({ projectId, input }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: projectKeys.lists() });
      await queryClient.cancelQueries({ queryKey: projectKeys.detail(projectId) });

      // Snapshot previous values
      const previousProjects = queryClient.getQueriesData<PaginatedProjectsResponse>({
        queryKey: projectKeys.lists(),
      });
      const previousProject = queryClient.getQueryData<Project>(projectKeys.detail(projectId));

      // Optimistically update list
      updateProjectListCache(queryClient, (old) => {
        if (!old) return old;

        return {
          ...old,
          items: old.items.map((project) =>
            project.id === projectId
              ? {
                  ...project,
                  ...input,
                  updatedAt: new Date().toISOString(),
                }
              : project,
          ),
        };
      });

      // Optimistically update detail
      if (previousProject) {
        queryClient.setQueryData<Project>(projectKeys.detail(projectId), {
          ...previousProject,
          ...input,
          updatedAt: new Date().toISOString(),
        });
      }

      return { previousProjects, previousProject };
    },

    // Rollback on error
    onError: (_err, { projectId }, context) => {
      if (context?.previousProjects) {
        context.previousProjects.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousProject) {
        queryClient.setQueryData(projectKeys.detail(projectId), context.previousProject);
      }
    },

    // Refetch on success
    onSuccess: (_data, { projectId }) => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
    },
  });
}

/**
 * Hook to delete a project with optimistic updates
 */
export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => projectsApi.delete(projectId),

    // Optimistic update
    onMutate: async (projectId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: projectKeys.lists() });

      // Snapshot previous values
      const previousProjects = queryClient.getQueriesData<PaginatedProjectsResponse>({
        queryKey: projectKeys.lists(),
      });

      // Optimistically update list
      updateProjectListCache(queryClient, (old) => {
        if (!old) return old;

        return {
          ...old,
          items: old.items.filter((project) => project.id !== projectId),
          pagination: {
            ...old.pagination,
            count: Math.max(0, old.pagination.count - 1),
          },
        };
      });

      return { previousProjects };
    },

    // Rollback on error
    onError: (_err, _projectId, context) => {
      if (context?.previousProjects) {
        context.previousProjects.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },

    // Refetch on success
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}
