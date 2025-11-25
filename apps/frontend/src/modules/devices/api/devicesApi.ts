/**
 * Devices API Client
 * Typed API client functions for device CRUD operations
 */

import { apiClient } from '../../../lib/api';
import type {
  Device,
  CreateDeviceInput,
  UpdateDeviceInput,
  PaginatedDevicesResponse,
  PaginationParams,
} from '../types';

/**
 * Devices API
 */
export const devicesApi = {
  /**
   * List devices for a project with pagination
   */
  async list(projectId: string, params?: PaginationParams): Promise<PaginatedDevicesResponse> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.cursor) queryParams.set('cursor', params.cursor);

    const endpoint = `/projects/${projectId}/devices${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return apiClient.get<PaginatedDevicesResponse>(endpoint);
  },

  /**
   * Get a single device by ID
   * Note: The backend expects projectId in the path for consistency
   */
  async get(projectId: string, deviceId: string): Promise<Device> {
    return apiClient.get<Device>(`/projects/${projectId}/devices/${deviceId}`);
  },

  /**
   * Create a new device
   */
  async create(projectId: string, input: CreateDeviceInput): Promise<Device> {
    return apiClient.post<Device>(`/projects/${projectId}/devices`, input);
  },

  /**
   * Update an existing device
   */
  async update(projectId: string, deviceId: string, input: UpdateDeviceInput): Promise<Device> {
    return apiClient.patch<Device>(`/projects/${projectId}/devices/${deviceId}`, input);
  },

  /**
   * Delete a device
   */
  async delete(projectId: string, deviceId: string): Promise<void> {
    return apiClient.delete<void>(`/projects/${projectId}/devices/${deviceId}`);
  },
};
