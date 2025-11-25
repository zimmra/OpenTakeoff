/**
 * Devices API Client Tests
 * Unit tests for device API client functions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { devicesApi } from './devicesApi';
import { apiClient } from '../../../lib/api';
import type { Device, CreateDeviceInput, UpdateDeviceInput, PaginatedDevicesResponse } from '../types';

// Mock the API client
vi.mock('../../../lib/api', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('devicesApi', () => {
  const projectId = 'project-123';
  const deviceId = 'device-456';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('should fetch devices list without pagination params', async () => {
      const mockResponse: PaginatedDevicesResponse = {
        items: [
          {
            id: 'device-1',
            projectId,
            name: 'Test Device',
            description: null,
            color: null,
            iconKey: null,
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T00:00:00Z',
          },
        ],
        pagination: {
          count: 1,
          nextCursor: null,
          hasMore: false,
        },
      };

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      const result = await devicesApi.list(projectId);

      expect(apiClient.get).toHaveBeenCalledWith(`/projects/${projectId}/devices`);
      expect(result).toEqual(mockResponse);
    });

    it('should fetch devices list with pagination params', async () => {
      const mockResponse: PaginatedDevicesResponse = {
        items: [],
        pagination: {
          count: 0,
          nextCursor: 'cursor-123',
          hasMore: true,
        },
      };

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      const params = { limit: 10, cursor: 'cursor-abc' };
      const result = await devicesApi.list(projectId, params);

      expect(apiClient.get).toHaveBeenCalledWith(`/projects/${projectId}/devices?limit=10&cursor=cursor-abc`);
      expect(result).toEqual(mockResponse);
    });

    it('should handle only limit param', async () => {
      const mockResponse: PaginatedDevicesResponse = {
        items: [],
        pagination: { count: 0, nextCursor: null, hasMore: false },
      };

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      await devicesApi.list(projectId, { limit: 20 });

      expect(apiClient.get).toHaveBeenCalledWith(`/projects/${projectId}/devices?limit=20`);
    });
  });

  describe('get', () => {
    it('should fetch a single device', async () => {
      const mockDevice: Device = {
        id: deviceId,
        projectId,
        name: 'Test Device',
        description: 'Test description',
        color: '#FF0000',
        iconKey: 'icon-key',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      };

      vi.mocked(apiClient.get).mockResolvedValue(mockDevice);

      const result = await devicesApi.get(projectId, deviceId);

      expect(apiClient.get).toHaveBeenCalledWith(`/projects/${projectId}/devices/${deviceId}`);
      expect(result).toEqual(mockDevice);
    });
  });

  describe('create', () => {
    it('should create a device', async () => {
      const input: CreateDeviceInput = {
        name: 'New Device',
        description: 'Device description',
        color: '#00FF00',
        iconKey: 'new-icon',
      };

      const mockDevice: Device = {
        id: 'new-device-id',
        projectId,
        name: input.name,
        description: input.description ?? null,
        color: input.color ?? null,
        iconKey: input.iconKey ?? null,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      };

      vi.mocked(apiClient.post).mockResolvedValue(mockDevice);

      const result = await devicesApi.create(projectId, input);

      expect(apiClient.post).toHaveBeenCalledWith(`/projects/${projectId}/devices`, input);
      expect(result).toEqual(mockDevice);
    });

    it('should create a device with minimal input', async () => {
      const input: CreateDeviceInput = {
        name: 'Minimal Device',
      };

      const mockDevice: Device = {
        id: 'minimal-device-id',
        projectId,
        name: input.name,
        description: null,
        color: null,
        iconKey: null,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      };

      vi.mocked(apiClient.post).mockResolvedValue(mockDevice);

      const result = await devicesApi.create(projectId, input);

      expect(apiClient.post).toHaveBeenCalledWith(`/projects/${projectId}/devices`, input);
      expect(result).toEqual(mockDevice);
    });
  });

  describe('update', () => {
    it('should update a device', async () => {
      const input: UpdateDeviceInput = {
        name: 'Updated Device',
        color: '#0000FF',
      };

      const mockDevice: Device = {
        id: deviceId,
        projectId,
        name: input.name!,
        description: null,
        color: input.color ?? null,
        iconKey: null,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T12:00:00Z',
      };

      vi.mocked(apiClient.patch).mockResolvedValue(mockDevice);

      const result = await devicesApi.update(projectId, deviceId, input);

      expect(apiClient.patch).toHaveBeenCalledWith(`/projects/${projectId}/devices/${deviceId}`, input);
      expect(result).toEqual(mockDevice);
    });

    it('should update a device with null values', async () => {
      const input: UpdateDeviceInput = {
        description: null,
        color: null,
      };

      const mockDevice: Device = {
        id: deviceId,
        projectId,
        name: 'Device',
        description: null,
        color: null,
        iconKey: null,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T12:00:00Z',
      };

      vi.mocked(apiClient.patch).mockResolvedValue(mockDevice);

      const result = await devicesApi.update(projectId, deviceId, input);

      expect(apiClient.patch).toHaveBeenCalledWith(`/projects/${projectId}/devices/${deviceId}`, input);
      expect(result).toEqual(mockDevice);
    });
  });

  describe('delete', () => {
    it('should delete a device', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue(undefined);

      await devicesApi.delete(projectId, deviceId);

      expect(apiClient.delete).toHaveBeenCalledWith(`/projects/${projectId}/devices/${deviceId}`);
    });
  });

  describe('error handling', () => {
    it('should propagate errors from API client', async () => {
      const error = new Error('API Error');
      vi.mocked(apiClient.get).mockRejectedValue(error);

      await expect(devicesApi.list(projectId)).rejects.toThrow('API Error');
    });
  });
});
