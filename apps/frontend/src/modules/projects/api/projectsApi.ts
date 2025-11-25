/**
 * Projects API Client
 * Typed API client functions for project CRUD operations
 */

import { apiClient } from '../../../lib/api';
import type {
  Project,
  CreateProjectInput,
  UpdateProjectInput,
  PaginatedProjectsResponse,
  PaginationParams,
} from '../types';

/**
 * Projects API
 */
export const projectsApi = {
  /**
   * List projects with pagination
   */
  async list(params?: PaginationParams): Promise<PaginatedProjectsResponse> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.cursor) queryParams.set('cursor', params.cursor);

    const endpoint = `/projects${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return apiClient.get<PaginatedProjectsResponse>(endpoint);
  },

  /**
   * Get a single project by ID
   */
  async get(projectId: string): Promise<Project> {
    return apiClient.get<Project>(`/projects/${projectId}`);
  },

  /**
   * Create a new project
   */
  async create(input: CreateProjectInput): Promise<Project> {
    return apiClient.post<Project>('/projects', input);
  },

  /**
   * Update an existing project
   */
  async update(projectId: string, input: UpdateProjectInput): Promise<Project> {
    return apiClient.patch<Project>(`/projects/${projectId}`, input);
  },

  /**
   * Delete a project
   */
  async delete(projectId: string): Promise<void> {
    return apiClient.delete<void>(`/projects/${projectId}`);
  },
};
