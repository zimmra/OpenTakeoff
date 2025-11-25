/**
 * Stamps API Client
 * API functions for stamp CRUD operations
 */

import { apiClient } from '../../../lib/api';
import type { Stamp, StampPosition } from '../types';

/**
 * API request/response types
 */
export interface CreateStampRequest {
  deviceId: string;
  locationId?: string;
  position: StampPosition;
}

export interface UpdateStampRequest {
  position?: StampPosition;
  locationId?: string | null;
  updatedAt?: string;
}

export interface ListStampsParams {
  limit?: number;
  cursor?: string;
}

export interface ListStampsResponse {
  items: Stamp[];
  pagination: {
    count: number;
    nextCursor: string | null;
    hasMore: boolean;
  };
}

/**
 * Stamps API
 */
export const stampsApi = {
  /**
   * List stamps for a plan
   */
  async list(planId: string, params?: ListStampsParams): Promise<ListStampsResponse> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.cursor) queryParams.set('cursor', params.cursor);

    const endpoint = `/plans/${planId}/stamps${queryParams.toString() ? `?${queryParams}` : ''}`;
    return apiClient.get<ListStampsResponse>(endpoint);
  },

  /**
   * Get a single stamp by ID
   */
  async getById(planId: string, stampId: string): Promise<Stamp> {
    return apiClient.get<Stamp>(`/plans/${planId}/stamps/${stampId}`);
  },

  /**
   * Create a new stamp
   */
  async create(planId: string, data: CreateStampRequest): Promise<Stamp> {
    return apiClient.post<Stamp>(`/plans/${planId}/stamps`, data);
  },

  /**
   * Update a stamp
   */
  async update(planId: string, stampId: string, data: UpdateStampRequest): Promise<Stamp> {
    return apiClient.patch<Stamp>(`/plans/${planId}/stamps/${stampId}`, data);
  },

  /**
   * Delete a stamp
   */
  async delete(planId: string, stampId: string): Promise<void> {
    return apiClient.delete<void>(`/plans/${planId}/stamps/${stampId}`);
  },
};
