/**
 * Plans API Client
 * Typed API client functions for plan operations including multipart uploads
 */

import { apiClient } from '../../../lib/api';
import type {
  Plan,
  PlanUploadResponse,
  PaginatedPlansResponse,
  PaginationParams,
} from '../types';

/**
 * Plans API
 */
export const plansApi = {
  /**
   * List plans for a project with pagination
   */
  async list(projectId: string, params?: PaginationParams): Promise<PaginatedPlansResponse> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.cursor) queryParams.set('cursor', params.cursor);

    const endpoint = `/projects/${projectId}/plans${
      queryParams.toString() ? `?${queryParams.toString()}` : ''
    }`;
    return apiClient.get<PaginatedPlansResponse>(endpoint);
  },

  /**
   * Get a single plan by ID
   */
  async get(projectId: string, planId: string): Promise<Plan> {
    return apiClient.get<Plan>(`/projects/${projectId}/plans/${planId}`);
  },

  /**
   * Upload a new PDF plan
   * Uses FormData for multipart upload
   */
  async upload(projectId: string, file: File): Promise<PlanUploadResponse> {
    const formData = new FormData();
    formData.append('pdf', file);

    // Use apiClient.request directly to allow FormData to set its own headers
    // Note: apiClient already prefixes with /api so we don't need to add it here
    // But the backend routes were missing /api prefix which we fixed
    return apiClient.request<PlanUploadResponse>(`/projects/${projectId}/plans`, {
      method: 'POST',
      body: formData,
    });
  },

  /**
   * Delete a plan
   */
  async delete(projectId: string, planId: string): Promise<void> {
    return apiClient.delete<void>(`/projects/${projectId}/plans/${planId}`);
  },
};
